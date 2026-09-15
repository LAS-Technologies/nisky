export type ApiFieldError = { field: string; message: string };

export type CalendarConflictDetails = {
  kind: "TIME_BLOCK" | "EVENT";
  id: string;
  label: string;
  date: string;
  startMin: number;
  endMin: number;
  source: "base" | "exception";
};

export type ApiError = {
  code: string;
  message: string;
  details?: ApiFieldError[] | CalendarConflictDetails;
};

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
};
