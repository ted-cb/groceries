/** Build-time version from VITE_APP_VERSION (set on deploy). Falls back for local dev. */
export const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined)?.trim() || 'dev';
