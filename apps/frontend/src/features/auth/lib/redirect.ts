export function safeInternalRedirect(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}

export function authSwitchHref(path: "/login" | "/register", redirect: string | null) {
  const safeRedirect = safeInternalRedirect(redirect);
  return safeRedirect ? `${path}?redirect=${encodeURIComponent(safeRedirect)}` : path;
}
