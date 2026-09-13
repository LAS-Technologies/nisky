import { createSession, type BrowserAlias, type BrowserProfile, type EmulationOS, type Session } from "wreq-js";
import { isUasdHost, UasdError } from "./types";
import type { UasdBrowser } from "./types";

export type UasdHttpMethod = "GET" | "POST";

export interface UasdHttpHeaders {
  get(name: string): string | null;
}

export interface UasdHttpResponse {
  status: number;
  url: string;
  headers: UasdHttpHeaders;
  body: string;
  redirected: boolean;
}

export interface UasdHttpRequest {
  method?: UasdHttpMethod;
  headers?: Record<string, string>;
  body?: string;
  maxRedirects?: number;
}

export interface UasdTransportStats {
  requests: number;
  redirects: number;
}

export interface UasdHttpClient {
  request(url: string | URL, init?: UasdHttpRequest): Promise<UasdHttpResponse>;
  close(): Promise<void>;
  readonly stats: UasdTransportStats;
}

export interface UasdRequestLog {
  method: UasdHttpMethod;
  url: string;
  status: number;
  redirected: boolean;
}

export interface UasdTransportOptions {
  browser?: UasdBrowser;
  os?: EmulationOS;
  proxy?: string;
  timeoutMs?: number;
  maxRedirects?: number;
  logger?: (entry: UasdRequestLog) => void;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const SAFE_LOG_QUERY_KEYS = new Set(["view", "course", "time", "id"]);
const DEFAULT_MAX_REDIRECTS = 8;
const DEFAULT_TIMEOUT_MS = 40_000;

export function validateUasdUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UasdError("UNEXPECTED_HOST", "La URL UASD no es valida");
  }

  if (url.protocol !== "https:" || (url.port !== "" && url.port !== "443") || url.username || url.password || !isUasdHost(url.hostname)) {
    throw new UasdError("UNEXPECTED_HOST", "La URL UASD apunta a un destino no permitido");
  }
  return url;
}

export function redactedUrl(input: string | URL): string {
  try {
    const url = new URL(input);
    const safeQuery = [...url.searchParams]
      .filter(([key]) => SAFE_LOG_QUERY_KEYS.has(key.toLocaleLowerCase()))
      .map(([key, value]): [string, string] => [key, value]);
    const query = new URLSearchParams(safeQuery).toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return "[url invalida]";
  }
}

export function redirectMethod(status: number, method: UasdHttpMethod): UasdHttpMethod {
  return status === 303 || ((status === 301 || status === 302) && method === "POST") ? "GET" : method;
}

export async function createUasdTransport(options: UasdTransportOptions = {}): Promise<UasdHttpClient> {
  const browser = options.browser ?? envBrowser();
  const proxy = options.proxy ?? (process.env.UASD_PROXY_URL?.trim() || undefined);
  const timeoutMs = options.timeoutMs ?? positiveInteger(process.env.UASD_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS;
  const logger = options.logger ?? (process.env.UASD_VERBOSE_LOGS === "true" ? defaultLogger : silentLogger);
  let session: Session;

  try {
    session = await createSession({
      browser,
      ...(options.os ? { os: options.os } : {}),
      ...(proxy ? { proxy } : {}),
      timeout: timeoutMs,
      defaultHeaders: {
        "Accept-Language": "es-DO,es;q=0.9,en;q=0.8",
      },
    });
  } catch {
    throw new UasdError("TRANSPORT_ERROR", "No se pudo iniciar la sesion de transporte UASD", true);
  }

  return createSessionClient(session, {
    timeoutMs,
    maxRedirects: options.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    logger,
  });
}

function createSessionClient(
  session: Session,
  options: Required<Pick<UasdTransportOptions, "timeoutMs" | "maxRedirects" | "logger">>,
): UasdHttpClient {
  const stats: UasdTransportStats = { requests: 0, redirects: 0 };
  let closed = false;

  return {
    get stats() {
      return { ...stats };
    },

    async request(input, init = {}) {
      if (closed) throw new UasdError("TRANSPORT_ERROR", "La sesion de transporte UASD ya esta cerrada");

      let currentUrl = validateUasdUrl(input);
      let method = init.method ?? "GET";
      let headers = { ...(init.headers ?? {}) };
      let body = init.body;
      const maxRedirects = init.maxRedirects ?? options.maxRedirects;
      let redirects = 0;

      while (true) {
        let response: Awaited<ReturnType<Session["fetch"]>>;
        try {
          stats.requests += 1;
          response = await session.fetch(currentUrl, {
            method,
            headers,
            ...(body === undefined ? {} : { body }),
            redirect: "manual",
            timeout: options.timeoutMs,
          });
        } catch {
          throw new UasdError("TRANSPORT_ERROR", "No se pudo completar una solicitud UASD", true);
        }

        const responseBody = await readResponseBody(response);
        const location = response.headers.get("location");
        const isRedirect = REDIRECT_STATUSES.has(response.status) && location !== null;
        options.logger({
          method,
          url: redactedUrl(currentUrl),
          status: response.status,
          redirected: isRedirect,
        });

        if (!isRedirect) {
          return {
            status: response.status,
            url: currentUrl.toString(),
            headers: response.headers,
            body: responseBody,
            redirected: redirects > 0,
          };
        }

        if (redirects >= maxRedirects) {
          throw new UasdError("REMOTE_BLOCKED", "El handoff UASD supero el limite de redirects", true);
        }

        let nextUrl: URL;
        try {
          nextUrl = validateUasdUrl(new URL(location, currentUrl));
        } catch (error) {
          if (error instanceof UasdError) throw error;
          throw new UasdError("UNEXPECTED_HOST", "El redirect UASD no es valido");
        }

        redirects += 1;
        stats.redirects += 1;
        const nextMethod = redirectMethod(response.status, method);
        if (nextMethod !== method) {
          const nextHeaders = { ...headers };
          delete nextHeaders["content-type"];
          delete nextHeaders["Content-Type"];
          delete nextHeaders["content-length"];
          delete nextHeaders["Content-Length"];
          headers = nextHeaders;
          body = undefined;
        }
        method = nextMethod;
        currentUrl = nextUrl;
      }
    },

    async close() {
      if (closed) return;
      closed = true;
      await session.close();
    },
  };
}

async function readResponseBody(response: Awaited<ReturnType<Session["fetch"]>>): Promise<string> {
  try {
    return await response.text();
  } catch {
    throw new UasdError("TRANSPORT_ERROR", "No se pudo leer la respuesta UASD", true);
  }
}

function envBrowser(): BrowserProfile | BrowserAlias {
  return (process.env.UASD_WREQ_BROWSER?.trim() || "chrome_149") as BrowserProfile | BrowserAlias;
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function defaultLogger(entry: UasdRequestLog): void {
  const color = colorForStatus(entry.status);
  const reset = color ? "\u001b[0m" : "";
  process.stderr.write(`${color}[uasd] ${entry.method} ${entry.url} -> HTTP ${entry.status}${entry.redirected ? " redirect" : ""}${reset}\n`);
}

function silentLogger(_entry: UasdRequestLog): void {
  // Request-level logs are opt-in; the worker emits one summary per job.
}

function colorForStatus(status: number): string {
  if (process.env.NO_COLOR !== undefined || !process.stderr.isTTY) return "";
  if (status >= 200 && status < 300) return "\u001b[32m";
  if (status >= 300 && status < 400) return "\u001b[33m";
  if (status >= 400 && status < 500) return "\u001b[31m";
  if (status >= 500) return "\u001b[35m";
  return "\u001b[36m";
}
