import { apiJson } from "@/lib/auth";

export type WhatsAppEnv = {
  app_id: string;
  access_token: string;
  access_token_set?: boolean;
  phone_number_id: string;
  business_account_id: string;
  business_phone: string;
  graph_api_version: string;
  app_secret: string;
  app_secret_set?: boolean;
  verify_token: string;
  /** Meta message template name, e.g. cardscan_intro */
  template_name: string;
  /** Meta template language, e.g. en_US */
  template_language_code: string;
  enabled: boolean;
};

export type EmailEnv = {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_password_set?: boolean;
  smtp_from: string;
  enabled: boolean;
};

export type GoogleSheetsEnv = {
  google_sheet_id: string;
  google_sheet_name: string;
  google_service_account_json: string;
  google_service_account_json_set?: boolean;
  google_drive_folder_id: string;
  google_oauth_client_id: string;
  google_oauth_client_secret: string;
  google_oauth_client_secret_set?: boolean;
  google_oauth_redirect_uri: string;
  enabled: boolean;
};

export type WhatsAppHeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

export type TemplateEnv = {
  email_subject: string;
  email_body: string;
  whatsapp_header_format: WhatsAppHeaderFormat;
  whatsapp_header: string;
  whatsapp_header_media_url: string;
  whatsapp_header_media_filename: string;
  whatsapp_body: string;
  whatsapp_footer: string;
  whatsapp_button_text: string;
  whatsapp_button_url: string;
  preview_name: string;
  preview_company: string;
  preview_phone: string;
  preview_email: string;
  preview_website: string;
  preview_signoff: string;
  /** {{N}} → review-page field key (e.g. "1" → "fullName") */
  token_map: Record<string, string>;
};

export type AdminEnvRow = {
  admin_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  company_id: string | null;
  company_name: string;
  created_at?: string;
  updated_at?: string;
  has_settings: boolean;
  whatsapp: WhatsAppEnv;
  emailEnv: EmailEnv;
  googleSheets: GoogleSheetsEnv;
  templates: TemplateEnv;
  settings_updated_at?: string | null;
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

const EMPTY_WHATSAPP: WhatsAppEnv = {
  app_id: "",
  access_token: "",
  phone_number_id: "",
  business_account_id: "",
  business_phone: "",
  graph_api_version: "v25.0",
  app_secret: "",
  verify_token: "",
  template_name: "card_final_ula",
  template_language_code: "en",
  enabled: false,
};

const EMPTY_EMAIL: EmailEnv = {
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_password: "",
  smtp_from: "",
  enabled: false,
};

const EMPTY_GOOGLE_SHEETS: GoogleSheetsEnv = {
  google_sheet_id: "",
  google_sheet_name: "Day 1",
  google_service_account_json: "",
  google_drive_folder_id: "",
  google_oauth_client_id: "",
  google_oauth_client_secret: "",
  google_oauth_redirect_uri: "",
  enabled: false,
};

export const EMPTY_TEMPLATES: TemplateEnv = {
  email_subject: "Thank you for connecting, {{1}}",
  email_body: "",
  whatsapp_header_format: "NONE",
  whatsapp_header: "CardScan Message",
  whatsapp_header_media_url: "",
  whatsapp_header_media_filename: "brochure.pdf",
  whatsapp_body:
    "Hello {{1}},\nThank you for sharing your business card details.\nYour contact information has been received successfully.\nWe will get back to you regarding the details provided — {{5}}.\nThank you",
  whatsapp_footer: "Thank you",
  whatsapp_button_text: "",
  whatsapp_button_url: "",
  preview_name: "Alex",
  preview_company: "Acme Corp",
  preview_phone: "+91 98765 43210",
  preview_email: "partner@example.com",
  preview_website: "https://example.com",
  preview_signoff: "B2B Team",
  token_map: { ...DEFAULT_TOKEN_MAP },
};

function asWhatsApp(raw: unknown): WhatsAppEnv {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const access = String(o.access_token ?? o.permanent_token ?? "") || "";
  const phone = String(o.business_phone ?? o.business_phone_number ?? "") || "";
  const waba = String(o.business_account_id ?? o.waba_id ?? "") || "";
  const version =
    String(o.graph_api_version ?? o.api_version ?? EMPTY_WHATSAPP.graph_api_version) ||
    EMPTY_WHATSAPP.graph_api_version;
  const lang =
    String(o.template_language_code ?? o.language ?? EMPTY_WHATSAPP.template_language_code) ||
    EMPTY_WHATSAPP.template_language_code;
  const tplName =
    String(
      o.template_name ??
        o.card_received_template_name ??
        o.business_card_template_name ??
        o.scan_template_name ??
        EMPTY_WHATSAPP.template_name,
    ) || EMPTY_WHATSAPP.template_name;
  return {
    ...EMPTY_WHATSAPP,
    app_id: String(o.app_id ?? ""),
    access_token: access,
    access_token_set: Boolean(o.access_token_set || o.permanent_token_set),
    phone_number_id: String(o.phone_number_id ?? ""),
    business_account_id: waba,
    business_phone: phone,
    graph_api_version: version,
    app_secret: String(o.app_secret ?? ""),
    app_secret_set: Boolean(o.app_secret_set),
    verify_token: String(o.verify_token ?? ""),
    template_name: tplName,
    template_language_code: lang,
    enabled: Boolean(o.enabled),
  };
}

function asEmail(raw: unknown): EmailEnv {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...EMPTY_EMAIL,
    smtp_host: String(o.smtp_host ?? ""),
    smtp_port: String(o.smtp_port ?? EMPTY_EMAIL.smtp_port),
    smtp_user: String(o.smtp_user ?? o.smtp_username ?? ""),
    smtp_password: String(o.smtp_password ?? ""),
    smtp_password_set: Boolean(o.smtp_password_set),
    smtp_from: String(o.smtp_from ?? o.sender_email ?? ""),
    enabled: Boolean(o.enabled),
  };
}

function asGoogleSheets(raw: unknown): GoogleSheetsEnv {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...EMPTY_GOOGLE_SHEETS,
    google_sheet_id: String(o.google_sheet_id ?? o.sheet_id ?? ""),
    google_sheet_name: String(o.google_sheet_name ?? o.sheet_name ?? EMPTY_GOOGLE_SHEETS.google_sheet_name),
    google_service_account_json: String(o.google_service_account_json ?? o.service_account_json ?? ""),
    google_service_account_json_set: Boolean(
      o.google_service_account_json_set || o.service_account_json_set,
    ),
    google_drive_folder_id: String(
      o.google_drive_folder_id ?? o.google_root_folder_id ?? o.drive_folder_id ?? "",
    ),
    google_oauth_client_id: String(o.google_oauth_client_id ?? o.oauth_client_id ?? ""),
    google_oauth_client_secret: String(o.google_oauth_client_secret ?? o.oauth_client_secret ?? ""),
    google_oauth_client_secret_set: Boolean(
      o.google_oauth_client_secret_set || o.oauth_client_secret_set,
    ),
    google_oauth_redirect_uri: String(o.google_oauth_redirect_uri ?? o.oauth_redirect_uri ?? ""),
    enabled: Boolean(o.enabled),
  };
}

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
  const fmtRaw = String(o.whatsapp_header_format ?? EMPTY_TEMPLATES.whatsapp_header_format)
    .trim()
    .toUpperCase();
  const fmt: WhatsAppHeaderFormat = (
    ["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"] as const
  ).includes(fmtRaw as WhatsAppHeaderFormat)
    ? (fmtRaw as WhatsAppHeaderFormat)
    : "NONE";
  return {
    email_subject: String(o.email_subject ?? EMPTY_TEMPLATES.email_subject),
    email_body: String(o.email_body ?? ""),
    whatsapp_header_format: fmt,
    whatsapp_header: String(o.whatsapp_header ?? EMPTY_TEMPLATES.whatsapp_header),
    whatsapp_header_media_url: String(o.whatsapp_header_media_url ?? ""),
    whatsapp_header_media_filename: String(
      o.whatsapp_header_media_filename ?? EMPTY_TEMPLATES.whatsapp_header_media_filename,
    ),
    whatsapp_body: String(o.whatsapp_body ?? EMPTY_TEMPLATES.whatsapp_body),
    whatsapp_footer: String(o.whatsapp_footer ?? EMPTY_TEMPLATES.whatsapp_footer),
    whatsapp_button_text: String(o.whatsapp_button_text ?? ""),
    whatsapp_button_url: String(o.whatsapp_button_url ?? ""),
    preview_name: String(o.preview_name ?? EMPTY_TEMPLATES.preview_name),
    preview_company: String(o.preview_company ?? EMPTY_TEMPLATES.preview_company),
    preview_phone: String(o.preview_phone ?? EMPTY_TEMPLATES.preview_phone),
    preview_email: String(o.preview_email ?? EMPTY_TEMPLATES.preview_email),
    preview_website: String(o.preview_website ?? EMPTY_TEMPLATES.preview_website),
    preview_signoff: String(o.preview_signoff ?? EMPTY_TEMPLATES.preview_signoff),
    token_map: normalizeTokenMap(o.token_map),
  };
}

export const WHATSAPP_HEADER_FORMATS: { value: WhatsAppHeaderFormat; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "TEXT", label: "Text" },
  { value: "IMAGE", label: "Photo / Image" },
  { value: "VIDEO", label: "Video" },
  { value: "DOCUMENT", label: "Brochure / Document (PDF)" },
];

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
    googleSheets: asGoogleSheets(raw.google_sheets),
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
  payload: {
    whatsapp: WhatsAppEnv;
    email: EmailEnv;
    templates: TemplateEnv;
    googleSheets: GoogleSheetsEnv;
  },
): Promise<AdminEnvRow> {
  const res = await apiJson<{ success: boolean; item: Record<string, unknown> }>(
    `/api/cms/admin-env/${adminId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        whatsapp: { ...payload.whatsapp, enabled: Boolean(payload.whatsapp.enabled) },
        email: { ...payload.email, enabled: Boolean(payload.email.enabled) },
        templates: payload.templates,
        google_sheets: {
          ...payload.googleSheets,
          enabled: Boolean(payload.googleSheets.enabled),
        },
      }),
    },
  );
  return normalizeAdminEnvItem(res.item);
}

/** Deletes CMS env for this Admin; scanner falls back to global .env. */
export async function removeAdminEnv(adminId: string): Promise<AdminEnvRow> {
  const res = await apiJson<{ success: boolean; item: Record<string, unknown> }>(
    `/api/cms/admin-env/${adminId}`,
    { method: "DELETE" },
  );
  return normalizeAdminEnvItem(res.item);
}

export async function testAdminWhatsApp(
  adminId: string,
  payload: {
    contact_phone: string;
    whatsapp: WhatsAppEnv;
    templates: TemplateEnv;
  },
): Promise<{ success: boolean; message_id?: string; template?: string; to?: string }> {
  return apiJson(`/api/cms/admin-env/${adminId}/test-whatsapp`, {
    method: "POST",
    body: JSON.stringify({
      contact_phone: payload.contact_phone,
      whatsapp: { ...payload.whatsapp, enabled: true },
      templates: payload.templates,
    }),
  });
}

export async function testAdminEmail(
  adminId: string,
  payload: {
    contact_email: string;
    email: EmailEnv;
    templates: TemplateEnv;
  },
): Promise<{ success: boolean; to?: string; subject?: string }> {
  return apiJson(`/api/cms/admin-env/${adminId}/test-email`, {
    method: "POST",
    body: JSON.stringify({
      contact_email: payload.contact_email,
      email: { ...payload.email, enabled: true },
      templates: payload.templates,
    }),
  });
}

export async function testAdminGoogleSheets(
  adminId: string,
  payload: { googleSheets: GoogleSheetsEnv },
): Promise<{ success: boolean; message?: string; sheet_id?: string; sheet_title?: string }> {
  return apiJson(`/api/cms/admin-env/${adminId}/test-google-sheets`, {
    method: "POST",
    body: JSON.stringify({
      google_sheets: { ...payload.googleSheets, enabled: true },
    }),
  });
}

export function displayName(row: Pick<AdminEnvRow, "first_name" | "last_name" | "email">): string {
  const name = `${row.first_name || ""} ${row.last_name || ""}`.trim();
  return name || row.email;
}

export const WHATSAPP_FIELD_LABELS: Partial<Record<keyof WhatsAppEnv, string>> = {
  app_id: "App ID",
  access_token: "Access token",
  phone_number_id: "Phone number ID",
  business_account_id: "WhatsApp Business Account ID",
  business_phone: "Display phone number",
  graph_api_version: "Graph API version",
  app_secret: "App secret",
  verify_token: "Webhook verify token",
  template_name: "Message template name",
  template_language_code: "Template language",
};

export const EMAIL_FIELD_LABELS: Partial<Record<keyof EmailEnv, string>> = {
  smtp_host: "SMTP_HOST",
  smtp_port: "SMTP_PORT",
  smtp_user: "SMTP_USER",
  smtp_password: "SMTP_PASSWORD",
  smtp_from: "SMTP_FROM",
};

export const GOOGLE_SHEETS_FIELD_LABELS: Partial<Record<keyof GoogleSheetsEnv, string>> = {
  google_sheet_id: "Google Sheet ID",
  google_sheet_name: "Google Sheet Name",
  google_service_account_json: "Google Service Account JSON",
  google_drive_folder_id: "Google Root Folder ID",
  google_oauth_client_id: "Google OAuth Client ID",
  google_oauth_client_secret: "Google OAuth Client Secret",
  google_oauth_redirect_uri: "Google OAuth Redirect URI",
};

export const WHATSAPP_INPUT_KEYS: (keyof WhatsAppEnv)[] = [
  "app_id",
  "access_token",
  "phone_number_id",
  "business_account_id",
  "business_phone",
  "graph_api_version",
  "app_secret",
  "verify_token",
  "template_name",
  "template_language_code",
];

export const EMAIL_INPUT_KEYS: (keyof EmailEnv)[] = [
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_password",
  "smtp_from",
];

export const GOOGLE_SHEETS_INPUT_KEYS: (keyof GoogleSheetsEnv)[] = [
  "google_sheet_id",
  "google_sheet_name",
  "google_service_account_json",
  "google_drive_folder_id",
  "google_oauth_client_id",
  "google_oauth_client_secret",
  "google_oauth_redirect_uri",
];

export const SECRET_WHATSAPP = new Set<string>(["access_token", "app_secret"]);
export const SECRET_EMAIL = new Set<string>(["smtp_password"]);
export const SECRET_GOOGLE_SHEETS = new Set<string>([
  "google_service_account_json",
  "google_oauth_client_secret",
]);
