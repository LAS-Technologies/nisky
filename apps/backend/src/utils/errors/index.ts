export const ERRORS = {
  BAD_REQUEST: { http: 400, msg: "Solicitud no válida" },
  UNAUTHORIZED: { http: 401, msg: "No autorizado" },
  FORBIDDEN: { http: 403, msg: "Acceso denegado" },
  NOT_FOUND: { http: 404, msg: "Recurso no encontrado" },
  CONFLICT: { http: 409, msg: "Conflicto de datos" },
  RATE_LIMITED: { http: 429, msg: "Demasiados intentos. Inténtalo más tarde" },
  FILE_UPLOAD: { http: 400, msg: "Error al subir el archivo" },
  INTERNAL: { http: 500, msg: "Error interno del servidor" },
  BAD_GATEWAY: { http: 502, msg: "Error al comunicarse con el servicio externo" },
  GATEWAY_TIMEOUT: { http: 504, msg: "El servicio externo tardó demasiado en responder" },
} as const;

export type ErrorCode = keyof typeof ERRORS;
