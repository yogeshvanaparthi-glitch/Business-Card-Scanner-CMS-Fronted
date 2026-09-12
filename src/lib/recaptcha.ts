/**
 * Google reCAPTCHA v2 site key (public client key).
 * Set VITE_RECAPTCHA_SITE_KEY in Amplify / .env, or fall back to the shared
 * NameCardScan production site key.
 */
const ENV_KEY = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || "").trim();
export const RECAPTCHA_SITE_KEY =
  ENV_KEY || "6LfmtrUtAAAAAAXaPQdzLMILPzy7kjVcKBAbDniA";
