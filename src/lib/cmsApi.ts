import { apiJson } from "@/lib/auth";

export type WhatsAppEnv = {
  admin_whatsapp_number: string;
  business_phone_number: string;
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  access_token_set?: boolean;
  permanent_token: string;
  permanent_token_set?: boolean;
  api_version: string;
  template_name: string;
  language: string;
  status: string;
  enabled: boolean;
};

export type EmailEnv = {
  sender_name: string;
  sender_email: string;
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  smtp_password_set?: boolean;
  api_key: string;
  api_key_set?: boolean;
  provider: string;
  reply_email: string;
  enabled: boolean;
};

export type TemplateEnv = {
  email_subject: string;
  email_body: string;
  whatsapp_body: string;
  preview_name: string;
  preview_company: string;
  preview_phone: string;
  preview_email: string;
  preview_website: string;
  preview_signoff: string;
  /** {{N}} → review-page field key (e.g. "1" → "fullName") */
  token_map: Record<string, string>;
};

/** Same fields as the scanner Review page (plus event / sign-off). */
export const REVIEW_FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: "fullName", label: "Full Name" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "designation", label: "Designation" },
  { key: "companyName", label: "Company Name" },
  { key: "countryCode", label: "Country Code" },
  { key: "phoneNumber", label: "Primary Phone" },
  { key: "secondaryPhoneNumber", label: "Secondary Phone" },
  { key: "emailAddress", label: "Primary Email" },
  { key: "secondaryEmailAddress", label: "Secondary Email" },
  { key: "website", label: "Primary Website" },
  { key: "secondaryWebsite", label: "Secondary Website" },
  { key: "address", label: "Primary Address" },
  { key: "secondaryAddress", label: "Secondary Address" },
  { key: "socialLinks", label: "Social Media Links" },
  { key: "gstNumber", label: "GST / Tax Number" },
  { key: "eventName", label: "Event Name" },
  { key: "eventDay", label: "Event Day" },
  { key: "notes", label: "Notes" },
  { key: "senderName", label: "Sender / Sign-off (CMS Email)" },
];

export const DEFAULT_TOKEN_MAP: Record<string, string> = {
  "1": "fullName",
  "2": "phoneNumber",
  "3": "emailAddress",
  "4": "website",
  "5": "companyName",
};

const PREVIEW_SAMPLES: Record<string, string> = {
  fullName: "Alex Rivera",
  firstName: "Alex",
  lastName: "Rivera",
  designation: "Product Manager",
  companyName: "Acme Corp",
  countryCode: "+91",
  phoneNumber: "+91 98765 43210",
  secondaryPhoneNumber: "+91 91234 56789",
  emailAddress: "partner@example.com",
  secondaryEmailAddress: "alt@example.com",
  website: "https://example.com",
  secondaryWebsite: "https://acme.example",
  address: "12 Market Street, Mumbai",
  secondaryAddress: "Warehouse B, Pune",
  socialLinks: "linkedin.com/in/alex",
  gstNumber: "27AAAAA0000A1Z5",
  eventName: "Tech Expo 2026",
  eventDay: "Day 1",
  notes: "Met at booth A12",
  senderName: "B2B Team",
};

export const EMPTY_TEMPLATES: TemplateEnv = {
  email_subject: "Thank you for connecting, {{1}}",
  email_body: "",
  whatsapp_body: "Hi {{1}}, thank you for connecting with us. — {{5}}",
  preview_name: "Alex",
  preview_company: "Acme Corp",
  preview_phone: "+91 98765 43210",
  preview_email: "partner@example.com",
  preview_website: "https://example.com",
  preview_signoff: "B2B Team",
  token_map: { ...DEFAULT_TOKEN_MAP },
};

function normalizeTokenMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TOKEN_MAP };
  const valid = new Set(REVIEW_FIELD_OPTIONS.map((o) => o.key));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const num = String(k).trim();
    const field = String(v ?? "").trim();
    if (!/^\d+$/.test(num) || !valid.has(field)) continue;
    out[num] = field;
  }
  return Object.keys(out).length ? out : { ...DEFAULT_TOKEN_MAP };
}

function asTemplates(raw: unknown): TemplateEnv {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    email_subject: String(o.email_subject ?? EMPTY_TEMPLATES.email_subject),
    email_body: String(o.email_body ?? ""),
    whatsapp_body: String(o.whatsapp_body ?? EMPTY_TEMPLATES.whatsapp_body),
    preview_name: String(o.preview_name ?? EMPTY_TEMPLATES.preview_name),
    preview_company: String(o.preview_company ?? EMPTY_TEMPLATES.preview_company),
    preview_phone: String(o.preview_phone ?? EMPTY_TEMPLATES.preview_phone),
    preview_email: String(o.preview_email ?? EMPTY_TEMPLATES.preview_email),
    preview_website: String(o.preview_website ?? EMPTY_TEMPLATES.preview_website),
    preview_signoff: String(o.preview_signoff ?? EMPTY_TEMPLATES.preview_signoff),
    token_map: normalizeTokenMap(o.token_map),
  };
}

/** Resolve preview sample for a mapped review field. */
export function previewValueForToken(t: TemplateEnv, tokenNum: string): string {
  const field = t.token_map[tokenNum];
  if (!field) return "";
  if (field === "senderName") return t.preview_signoff || PREVIEW_SAMPLES.senderName;
  if (field === "fullName" || field === "firstName") return t.preview_name || PREVIEW_SAMPLES[field];
  if (field === "companyName" || field === "eventName") {
    return t.preview_company || PREVIEW_SAMPLES[field];
  }
  if (field === "phoneNumber") return t.preview_phone || PREVIEW_SAMPLES.phoneNumber;
  if (field === "emailAddress") return t.preview_email || PREVIEW_SAMPLES.emailAddress;
  if (field === "website") return t.preview_website || PREVIEW_SAMPLES.website;
  return PREVIEW_SAMPLES[field] || "";
}

/** Apply CMS / thank-you tokens for live preview using token_map. */
export function applyTemplateVars(text: string, t: TemplateEnv): string {
  const year = String(new Date().getFullYear());
  let out = text || "";
  const nums = Object.keys(t.token_map)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => b - a);
  for (const n of nums) {
    const key = String(n);
    out = out.replaceAll(`{{${key}}}`, previewValueForToken(t, key));
  }
  // Legacy named tokens
  out = out
    .replaceAll("{{name}}", previewValueForToken(t, "1") || t.preview_name || "Alex")
    .replaceAll("{{company}}", t.preview_company || "Company")
    .replaceAll("{{phone}}", t.preview_phone || "")
    .replaceAll("{{email}}", t.preview_email || "")
    .replaceAll("{{GREETING}}", previewValueForToken(t, "1") || t.preview_name || "Alex")
    .replaceAll("{{EVENT_NAME}}", t.preview_company || "the event")
    .replaceAll("{{YEAR}}", year)
    .replaceAll("{{PDF_DOWNLOAD_HREF}}", "#");
  return out;
}

export function buildEmailPreviewHtml(shell: string, body: string, t: TemplateEnv): string {
  const filledBody = applyTemplateVars(body, t);
  const filledShell = applyTemplateVars(shell, t).replaceAll("{{BODY_HTML}}", filledBody);
  return filledShell;
}

export function normalizeAdminEnvItem(raw: Record<string, unknown>): AdminEnvRow {
  return {
    admin_id: String(raw.admin_id ?? ""),
    email: String(raw.email ?? ""),
    first_name: String(raw.first_name ?? ""),
    last_name: String(raw.last_name ?? ""),
    phone: String(raw.phone ?? ""),
    is_active: Boolean(raw.is_active),
    company_id: raw.company_id ? String(raw.company_id) : null,
    company_name: String(raw.company_name ?? ""),
    created_at: raw.created_at ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at ? String(raw.updated_at) : undefined,
    has_settings: Boolean(raw.has_settings),
    whatsapp: asWhatsApp(raw.whatsapp),
    emailEnv: asEmail(raw.email_settings),
    templates: asTemplates(raw.templates),
    settings_updated_at: raw.settings_updated_at ? String(raw.settings_updated_at) : null,
  };
}

export async function fetchAdminEnvList(): Promise<AdminEnvRow[]> {
  const data = await apiJson<{ items: Record<string, unknown>[] }>("/api/cms/admin-env");
  return (data.items || []).map((item) => normalizeAdminEnvItem(item));
}

export async function fetchEmailShell(): Promise<string> {
  const data = await apiJson<{ shell: string }>("/api/cms/email-shell");
  return data.shell || "";
}

export async function saveAdminEnv(
  adminId: string,
  payload: { whatsapp: WhatsAppEnv; email: EmailEnv; templates: TemplateEnv },
): Promise<AdminEnvRow> {
  const res = await apiJson<{ success: boolean; item: Record<string, unknown> }>(
    `/api/cms/admin-env/${adminId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        whatsapp: { ...payload.whatsapp, enabled: Boolean(payload.whatsapp.enabled) },
        email: { ...payload.email, enabled: Boolean(payload.email.enabled) },
        templates: payload.templates,
      }),
    },
  );
  return normalizeAdminEnvItem(res.item);
}

export function displayName(row: Pick<AdminEnvRow, "first_name" | "last_name" | "email">): string {
  const name = `${row.first_name || ""} ${row.last_name || ""}`.trim();
  return name || row.email;
}

export const WHATSAPP_FIELD_LABELS: Partial<Record<keyof WhatsAppEnv, string>> = {
  admin_whatsapp_number: "Admin WhatsApp Number",
  business_phone_number: "Business Phone Number",
  phone_number_id: "Phone Number ID",
  waba_id: "WABA ID",
  access_token: "Access Token",
  permanent_token: "Permanent Token",
  api_version: "API Version",
  template_name: "Template Name",
  language: "Language",
  status: "Status",
};

export const EMAIL_FIELD_LABELS: Partial<Record<keyof EmailEnv, string>> = {
  sender_name: "Sender Name",
  sender_email: "Sender Email",
  smtp_host: "SMTP Host",
  smtp_port: "SMTP Port",
  smtp_username: "SMTP Username",
  smtp_password: "SMTP Password",
  api_key: "API Key",
  provider: "Provider",
  reply_email: "Reply Email",
};

export const WHATSAPP_INPUT_KEYS: (keyof WhatsAppEnv)[] = [
  "admin_whatsapp_number",
  "business_phone_number",
  "phone_number_id",
  "waba_id",
  "access_token",
  "permanent_token",
  "api_version",
  "template_name",
  "language",
  "status",
];

export const EMAIL_INPUT_KEYS: (keyof EmailEnv)[] = [
  "sender_name",
  "sender_email",
  "smtp_host",
  "smtp_port",
  "smtp_username",
  "smtp_password",
  "api_key",
  "provider",
  "reply_email",
];

export const SECRET_WHATSAPP = new Set<string>(["access_token", "permanent_token"]);
export const SECRET_EMAIL = new Set<string>(["smtp_password", "api_key"]);
