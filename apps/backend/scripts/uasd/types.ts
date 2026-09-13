import type { BrowserAlias, BrowserProfile } from "wreq-js";

export const UASD_TIME_ZONE = "America/Santo_Domingo";
export const UASD_GATEWAY_URL = "https://app.uasd.edu.do/UASDVirtualGateway";
export const UASD_LOGIN_URL = `${UASD_GATEWAY_URL}/Default.aspx/Login`;
export const UASD_SELECTION_URL = `${UASD_GATEWAY_URL}/Default.aspx/SeleccionAsignaturas`;

const UASD_HOST_SUFFIX = ".uasd.edu.do";

export function isUasdHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/u, "");
  return normalized.length > UASD_HOST_SUFFIX.length && normalized.endsWith(UASD_HOST_SUFFIX);
}

export type UasdBrowser = BrowserAlias | BrowserProfile;
export type UasdActivityKind = "assignment" | "quiz" | "forum";
export type UasdSource = "calendar" | "detail";

export type UasdErrorCode =
  | "INVALID_INPUT"
  | "AUTH_FAILED"
  | "CAPTCHA_REQUIRED"
  | "UNEXPECTED_RESPONSE"
  | "UNEXPECTED_HOST"
  | "HTTP_ERROR"
  | "REMOTE_BLOCKED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "TRANSPORT_ERROR"
  | "PARSE_ERROR";

export interface UasdErrorShape {
  code: UasdErrorCode;
  message: string;
  retryable: boolean;
  status?: number;
}

export class UasdError extends Error {
  readonly code: UasdErrorCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(code: UasdErrorCode, message: string, retryable = false, status?: number) {
    super(message);
    this.name = "UasdError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }

  toJSON(): UasdErrorShape {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.status === undefined ? {} : { status: this.status }),
    };
  }
}

export interface UasdScrapeInput {
  username: string;
  password: string;
  period: string;
  from: string;
  to: string;
  captcha?: string;
}

export interface UasdLoginAssignment {
  ASIGNATURA: string;
  CLAVE: string;
  CLAVE2: string;
  CRN: string;
  ESCUELA: string;
  FACULTAD: string;
  MODALIDAD: string;
  PERIODO: string;
  SECCION: string;
  URL: string;
  URL2?: string;
  response: number;
}

export interface UasdLoginRecord {
  response?: number;
  MATRICULA: string;
  MATRICULA2: string;
  TOKEN: string;
  ASIGNATURAS: UasdLoginAssignment[];
}

export interface UasdSelectionRecord extends UasdLoginAssignment {
  MATRICULA: string;
  MATRICULA2: string;
  TOKEN: string;
}

export interface UasdCourse {
  host: string;
  courseId: string;
  code: string;
  name: string;
  section: string;
  modality: string;
  period: string;
  url: string;
}

export interface UasdCalendarEvent {
  key: string;
  eventId: string | null;
  host: string;
  courseId: string;
  kind: UasdActivityKind;
  activityId: string;
  title: string;
  url: string;
  eventDate: string;
  eventName: string;
}

export interface UasdActivityDetails {
  kind: UasdActivityKind;
  title: string;
  url: string;
  completed: boolean;
  dueDate: string | null;
  openDate: string | null;
  closeDate: string | null;
  source: UasdSource;
}

export interface UasdRemoteItem {
  key: string;
  kind: UasdActivityKind;
  title: string;
  description: string | null;
  course: string | null;
  url: string;
  completed: boolean;
  dueDate: string | null;
  openDate: string | null;
  closeDate: string | null;
  source: UasdSource;
}

export interface UasdScrapeStats {
  requests: number;
  redirects: number;
  courses: number;
  calendarPages: number;
  calendarEvents: number;
  activityPages: number;
  items: number;
  durationMs: number;
}

export interface UasdScrapeSuccess {
  ok: true;
  period: string;
  courses: UasdCourse[];
  items: UasdRemoteItem[];
  stats: UasdScrapeStats;
}

export interface UasdScrapeFailure {
  ok: false;
  error: UasdErrorShape;
}

export type UasdScrapeResult = UasdScrapeSuccess | UasdScrapeFailure;
