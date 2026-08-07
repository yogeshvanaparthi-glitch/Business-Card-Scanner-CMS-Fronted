/** API base: empty in dev (Vite proxy); absolute URL in production builds. */
export function getApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
  if (import.meta.env.DEV) return "";
  return raw;
}

export const API_BASE = getApiBase();
