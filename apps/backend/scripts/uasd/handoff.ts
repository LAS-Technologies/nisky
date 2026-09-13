import { chooseTarget, courseUrl } from "./normalize";
import { UASD_GATEWAY_URL, isUasdHost, UasdError } from "./types";
import type { UasdCourse, UasdSelectionRecord } from "./types";
import type { UasdHttpClient, UasdHttpResponse } from "./transport";

const HANDOFF_PATH_RE = /\/login\/wsuasd\.php$/i;

export async function handoffCourse(client: UasdHttpClient, record: UasdSelectionRecord): Promise<UasdCourse> {
  const target = validateHandoffUrl(chooseTarget(record));
  const response = await client.request(target, {
    method: "POST",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-DO,es;q=0.9,en;q=0.8",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: new URL(UASD_GATEWAY_URL).origin,
      Referer: `${UASD_GATEWAY_URL}/`,
    },
    body: buildHandoffBody(record),
  });

  assertHandoffResponse(response);
  const finalCourse = courseUrl(response.url);
  return {
    host: finalCourse.host,
    courseId: finalCourse.courseId,
    code: record.CLAVE,
    name: record.ASIGNATURA,
    section: record.SECCION,
    modality: record.MODALIDAD,
    period: record.PERIODO,
    url: finalCourse.url,
  };
}

export function buildHandoffBody(record: UasdSelectionRecord): string {
  const params = new URLSearchParams({
    idu: record.MATRICULA,
    idu2: record.MATRICULA2,
    tk: record.TOKEN,
    course: record.CLAVE,
    seccion: "",
  });
  return params.toString();
}

export function validateHandoffUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UasdError("PARSE_ERROR", "La URL de handoff UASD no es valida");
  }
  if (url.protocol !== "https:" || (url.port !== "" && url.port !== "443") || !isUasdHost(url.hostname) || !HANDOFF_PATH_RE.test(url.pathname)) {
    throw new UasdError("UNEXPECTED_HOST", "La URL de handoff UASD no esta permitida");
  }
  return `${url.origin}${url.pathname}`;
}

function assertHandoffResponse(response: UasdHttpResponse): void {
  if (response.status === 429) throw new UasdError("RATE_LIMITED", "El handoff UASD fue limitado", true, response.status);
  if (response.status === 403) throw new UasdError("REMOTE_BLOCKED", "El handoff UASD fue bloqueado", true, response.status);
  if (response.status < 200 || response.status >= 300) {
    throw new UasdError("HTTP_ERROR", `El handoff UASD devolvio HTTP ${response.status}`, response.status >= 500, response.status);
  }
}
