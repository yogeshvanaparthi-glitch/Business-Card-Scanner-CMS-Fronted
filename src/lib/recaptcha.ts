/**
 * Google reCAPTCHA v2 site key (public client key).
 * Prefer Amplify/env override; fall back to the same key as the main NameCardScan app
 * so production CMS builds work without an extra Amplify variable.
 */
const ENV_KEY = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || "").trim();
const PROD_PUBLIC_SITE_KEY = "6LfmtrUtAAAAAAXaPQdzLMILPzy7kjVcKBAbDniA";

export const RECAPTCHA_SITE_KEY = ENV_KEY || PROD_PUBLIC_SITE_KEY;
