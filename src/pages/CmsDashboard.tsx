import { EnvironmentOverviewPanel } from "@/components/EnvironmentOverviewPanel";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import {
  applyTemplateVars,
  buildEmailPreviewHtml,
  displayName,
  EMAIL_FIELD_LABELS,
  EMAIL_INPUT_KEYS,
  fetchAdminEnvList,
  fetchEmailShell,
  formatGoogleSheetsHealthMessage,
  GOOGLE_SHEETS_FIELD_LABELS,
  GOOGLE_SHEETS_INPUT_KEYS,
  previewValueForToken,
  REVIEW_FIELD_OPTIONS,
  removeAdminEnv,
  removeCmsClient,
  saveAdminEnv,
  SECRET_EMAIL,
  SECRET_GOOGLE_SHEETS,
  SECRET_WHATSAPP,
  testAdminGoogleSheets,
  WHATSAPP_FIELD_LABELS,
  WHATSAPP_HEADER_FORMATS,
  WHATSAPP_INPUT_KEYS,
  type AdminEnvRow,
  type EmailEnv,
  type GoogleSheetsEnv,
  type GoogleSheetsHealthResult,
  type TemplateEnv,
  type WhatsAppEnv,
  type WhatsAppHeaderFormat,
} from "@/lib/cmsApi";

export function CmsDashboard() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [admins, setAdmins] = useState<AdminEnvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = admins.find((a) => a.admin_id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const items = await fetchAdminEnvList();
      setAdmins(items);
      setSelectedId((prev) => {
        if (prev && items.some((a) => a.admin_id === prev)) return prev;
        return items[0]?.admin_id ?? null;
      });
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to load admins",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const removeClient = async (admin: AdminEnvRow) => {
    const name = displayName(admin);
    const clientLabel = admin.company_name || name;
    if (
      !window.confirm(
        `Remove ${clientLabel} from CMS and the app?\n\nThis deletes the company, its Admin/Users, registration requests, and CMS WhatsApp/Email settings. They will disappear from both this list and Manage Team.`,
      )
    ) {
      return;
    }
    try {
      await removeCmsClient(admin.admin_id);
      setAdmins((prev) => {
        const next = prev.filter((a) => a.admin_id !== admin.admin_id);
        setSelectedId((current) => {
          if (current !== admin.admin_id) return current;
          return next[0]?.admin_id ?? null;
        });
        return next;
      });
      setMessage({
        type: "ok",
        text: `Removed ${clientLabel} from CMS and the app.`,
      });
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Remove failed",
      });
    }
  };

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--muted)]">
        Loading session…
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "SUPER_ADMIN") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--bg)]">
      {/* Full-width top bar */}
      <header className="sticky top-0 z-20 flex w-full items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-ink)]">
            NameCardScan CMS
          </p>
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
            Multi-client environment
          </h1>
          {selected ? (
            <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
              Active client:{" "}
              <span className="font-medium text-[var(--ink)]">
                {selected.company_name || displayName(selected)}
              </span>
              <span className="text-[var(--muted)]">
                {" "}
                · Tenant ID: {selected.tenant_id.slice(0, 8)}…
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-[var(--muted)]">Select a client to edit its settings</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden text-sm text-[var(--muted)] md:inline">{user.email}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md bg-[var(--ink)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Sign out
          </button>
        </div>
      </header>

      {message ? (
        <div
          className={`w-full whitespace-pre-line border-b px-4 py-2.5 text-sm sm:px-6 lg:px-8 ${
            message.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-[var(--danger)]"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {/* Full-width split workspace */}
      <div className="flex w-full flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-[var(--line)] bg-[var(--surface)] lg:w-80 lg:border-b-0 lg:border-r xl:w-96">
          <div className="border-b border-[var(--line)] px-4 py-3 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Clients
            </p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {loading
                ? "Loading…"
                : `${admins.length} client${admins.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="max-h-[40vh] overflow-y-auto lg:max-h-[calc(100vh-7.5rem)]">
            {loading ? (
              <p className="px-4 py-8 text-sm text-[var(--muted)]">Loading clients…</p>
            ) : admins.length === 0 ? (
              <div className="px-4 py-8 text-sm text-[var(--muted)] sm:px-5">
                <p className="font-medium text-[var(--ink)]">No clients yet</p>
                <p className="mt-2 leading-relaxed">
                  Create an Admin (client) in the main app (Manage Team). After they accept the
                  invite, refresh here to configure their WhatsApp, Email, and Google Sheets.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {admins.map((admin) => {
                  const active = admin.admin_id === selectedId;
                  return (
                    <li key={admin.admin_id}>
                      <div
                        className={`flex items-stretch gap-1 transition ${
                          active
                            ? "border-l-4 border-l-[var(--brand)] bg-[var(--brand-soft)]/50"
                            : "border-l-4 border-l-transparent hover:bg-slate-50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setMessage(null);
                            setSelectedId(admin.admin_id);
                          }}
                          className="min-w-0 flex-1 px-4 py-3 text-left sm:px-5"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                admin.is_active ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                              title={admin.is_active ? "Active" : "Inactive"}
                            />
                            <p className="truncate text-sm font-semibold text-[var(--ink)]">
                              {admin.company_name || displayName(admin)}
                            </p>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                            {admin.company_name ? displayName(admin) : admin.email}
                          </p>
                          <p className="mt-1 truncate font-mono text-[10px] text-[var(--muted)]">
                            Tenant: {admin.tenant_id}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {admin.company_name ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                {admin.company_name}
                              </span>
                            ) : null}
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                admin.has_settings
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-800"
                              }`}
                            >
                              {admin.has_settings ? "Env saved" : "Env empty"}
                            </span>
                            {admin.has_settings ? (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  admin.sync_status === "connected"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : admin.sync_status === "failed"
                                      ? "bg-red-50 text-red-700"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {admin.sync_status === "connected"
                                  ? "Connected"
                                  : admin.sync_status === "failed"
                                    ? "Not connected"
                                    : `v${admin.config_version || 1}`}
                              </span>
                            ) : null}
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                              {admin.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </button>
                        <button
                            type="button"
                            title="Remove client from CMS and the app"
                            aria-label={`Remove client ${displayName(admin)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void removeClient(admin);
                            }}
                            className="shrink-0 self-center px-3 py-2 text-xs font-semibold text-[var(--danger)] hover:bg-red-50"
                          >
                            Remove
                          </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-[var(--bg)]">
          {selected ? (
            <AdminEnvEditor
              key={selected.admin_id}
              admin={selected}
              onSaved={(next) => {
                setAdmins((prev) =>
                  prev.map((a) => (a.admin_id === next.admin_id ? next : a)),
                );
                setMessage({
                  type: "ok",
                  text: `Saved environment for ${displayName(next)}.`,
                });
              }}
              onRemoved={(next) => {
                setAdmins((prev) =>
                  prev.map((a) => (a.admin_id === next.admin_id ? next : a)),
                );
                setMessage({
                  type: "ok",
                  text: `Cleared CMS environment for ${displayName(next)}. Save again to reconnect channels.`,
                });
              }}
              onOk={(text) => setMessage({ type: "ok", text })}
              onError={(text) => setMessage({ type: "err", text })}
            />
          ) : (
            <div className="flex h-full min-h-[50vh] items-center justify-center px-6 text-center text-[var(--muted)]">
              {loading ? "Loading…" : "Select an Admin to edit WhatsApp and Email environment."}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function AdminEnvEditor({
  admin,
  onSaved,
  onRemoved,
  onOk,
  onError,
}: {
  admin: AdminEnvRow;
  onSaved: (row: AdminEnvRow) => void;
  onRemoved: (row: AdminEnvRow) => void;
  onOk: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [whatsapp, setWhatsapp] = useState<WhatsAppEnv>({ ...admin.whatsapp, enabled: false });
  const [emailEnv, setEmailEnv] = useState<EmailEnv>({ ...admin.emailEnv, enabled: false });
  const [googleSheets, setGoogleSheets] = useState<GoogleSheetsEnv>(admin.googleSheets);
  const [templates, setTemplates] = useState<TemplateEnv>(admin.templates);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [section, setSection] = useState<
    "overview" | "whatsapp" | "email" | "templates" | "google"
  >("overview");
  const [sheetsHealth, setSheetsHealth] = useState<{
    result: GoogleSheetsHealthResult;
    checkedAt: Date;
  } | null>(null);

  useEffect(() => {
    setWhatsapp({ ...admin.whatsapp, enabled: false });
    setEmailEnv({ ...admin.emailEnv, enabled: false });
    setGoogleSheets(admin.googleSheets);
    setTemplates(admin.templates);
    setSection("overview");
    setSheetsHealth(null);
  }, [admin]);

  const save = async () => {
    setSaving(true);
    try {
      const next = await saveAdminEnv(admin.admin_id, {
        whatsapp: { ...whatsapp, enabled: false },
        email: { ...emailEnv, enabled: false },
        templates,
        googleSheets,
      });
      onSaved(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        `Remove all CMS WhatsApp, Email, Google Sheets, and template settings for ${displayName(admin)}?\n\nThey will fall back to the server .env until you save again.`,
      )
    ) {
      return;
    }
    setRemoving(true);
    try {
      const next = await removeAdminEnv(admin.admin_id);
      onRemoved(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  };

  const runGoogleSheetsTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const res = await testAdminGoogleSheets(admin.admin_id, { googleSheets });
      const checkedAt = new Date();
      setSheetsHealth({ result: res, checkedAt });
      const detail = formatGoogleSheetsHealthMessage(res, checkedAt);
      if (res.success) {
        onOk(detail);
      } else {
        onError(detail);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const failed: GoogleSheetsHealthResult = {
        success: false,
        status: "failed",
        message: "Google Sheets connection failed.",
        reason:
          raw || "Unable to reach Google Sheets API. Please try again.",
      };
      const checkedAt = new Date();
      setSheetsHealth({ result: failed, checkedAt });
      onError(formatGoogleSheetsHealthMessage(failed, checkedAt));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex w-full flex-col gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-ink)]">
            Active client
          </p>
          <h2 className="truncate text-xl font-semibold tracking-tight">
            {admin.company_name || displayName(admin)}
          </h2>
          <p className="mt-1 truncate text-sm text-[var(--muted)]">
            {displayName(admin)} · {admin.email}
            {admin.phone ? ` · ${admin.phone}` : ""}
          </p>
          <p className="mt-1 font-mono text-xs text-[var(--muted)]">
            Tenant ID: {admin.tenant_id}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={removing || saving || !admin.has_settings}
            onClick={() => void remove()}
            className="rounded-md border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-[var(--danger)] shadow-sm hover:bg-red-50 disabled:opacity-40"
          >
            {removing ? "Clearing…" : "Clear env"}
          </button>
          <button
            type="button"
            disabled={saving || removing}
            onClick={() => void save()}
            className="rounded-md bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-ink)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Environment"}
          </button>
        </div>
      </div>

      <div className="w-full border-b border-[var(--line)] bg-[var(--surface)] px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              ["overview", "Environment"],
              ["templates", "Templates & preview"],
              ["whatsapp", "WhatsApp 🔒"],
              ["email", "Email 🔒"],
              ["google", "Google Sheets"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`relative whitespace-nowrap px-4 py-3 text-sm font-medium transition ${
                section === id
                  ? "text-[var(--brand-ink)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {label}
              {section === id ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--brand)]" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full flex-1 overflow-y-auto">
        {section === "overview" ? (
          <EnvironmentOverviewPanel
            admin={admin}
            onRefreshAdmin={onSaved}
            onOk={onOk}
            onError={onError}
          />
        ) : section === "templates" ? (
          <TemplatesWorkspace
            templates={templates}
            onChange={setTemplates}
          />
        ) : section === "whatsapp" ? (
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <FormSection
              title="WhatsApp Cloud API (Meta)"
              enabled={false}
              locked
              onEnabledChange={() => undefined}
            >
              <p className="mb-4 text-sm text-[var(--muted)]">
                Same keys as <code className="text-[var(--ink)]">BusinessCardScanner_Backend/.env</code>.
                Live WhatsApp send is frozen for this product stage. Credentials can still be stored
                for later; Test and Enable stay off.
              </p>
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {WHATSAPP_INPUT_KEYS.map((key) => (
                  <Field
                    key={key}
                    label={WHATSAPP_FIELD_LABELS[key] || key}
                    secret={SECRET_WHATSAPP.has(key)}
                    hint={
                      key === "access_token" && whatsapp.access_token_set
                        ? "Saved — leave blank to keep"
                        : key === "app_secret" && whatsapp.app_secret_set
                          ? "Saved — leave blank to keep"
                          : undefined
                    }
                    value={String(whatsapp[key] ?? "")}
                    onChange={(v) => setWhatsapp((w) => ({ ...w, [key]: v, enabled: false }))}
                  />
                ))}
              </div>
            </FormSection>
          </div>
        ) : section === "email" ? (
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <FormSection
              title="Email environment"
              enabled={false}
              locked
              onEnabledChange={() => undefined}
            >
              <p className="mb-4 text-sm text-[var(--muted)]">
                Live Email send is frozen for this product stage. SMTP settings can still be stored
                for later; Test and Enable stay off.
              </p>
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {EMAIL_INPUT_KEYS.map((key) => (
                  <Field
                    key={key}
                    label={EMAIL_FIELD_LABELS[key] || key}
                    secret={SECRET_EMAIL.has(key)}
                    placeholder={
                      key === "sender_notification_email"
                        ? "Enter sender notification email"
                        : undefined
                    }
                    hint={
                      key === "smtp_password" && emailEnv.smtp_password_set
                        ? "Saved — leave blank to keep"
                        : key === "sender_notification_email"
                          ? "Optional. Receives receiver/contact details after a successful send."
                          : undefined
                    }
                    value={String(emailEnv[key] ?? "")}
                    onChange={(v) => setEmailEnv((em) => ({ ...em, [key]: v, enabled: false }))}
                  />
                ))}
              </div>
            </FormSection>
          </div>
        ) : (
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <FormSection
              title="Google Sheets configuration"
              enabled={googleSheets.enabled}
              onEnabledChange={(enabled) => setGoogleSheets((g) => ({ ...g, enabled }))}
            >
              <p className="mb-4 text-sm text-[var(--muted)]">
                Per-Admin Google Sheets credentials used when contacts sync to Sheets. Service
                account JSON and OAuth client secret are masked after save — leave blank to keep
                existing values. Maps to{" "}
                <code className="text-[var(--ink)]">GOOGLE_SHEET_*</code> /{" "}
                <code className="text-[var(--ink)]">GOOGLE_OAUTH_*</code>.
              </p>
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {GOOGLE_SHEETS_INPUT_KEYS.map((key) => (
                  <Field
                    key={key}
                    label={GOOGLE_SHEETS_FIELD_LABELS[key] || key}
                    secret={SECRET_GOOGLE_SHEETS.has(key)}
                    multiline={key === "google_service_account_json"}
                    className={
                      key === "google_service_account_json" || key === "google_oauth_redirect_uri"
                        ? "md:col-span-2 xl:col-span-2"
                        : undefined
                    }
                    hint={
                      key === "google_service_account_json" &&
                      googleSheets.google_service_account_json_set
                        ? "Saved — leave blank to keep"
                        : key === "google_oauth_client_secret" &&
                            googleSheets.google_oauth_client_secret_set
                          ? "Saved — leave blank to keep"
                          : undefined
                    }
                    value={String(googleSheets[key] ?? "")}
                    onChange={(v) => setGoogleSheets((g) => ({ ...g, [key]: v }))}
                  />
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  disabled={testing || saving}
                  onClick={() => void runGoogleSheetsTest()}
                  className="shrink-0 rounded-md border border-[var(--brand)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--brand-ink)] shadow-sm hover:bg-[var(--brand-soft)]/40 disabled:opacity-50"
                >
                  {testing ? "Checking Connection…" : "Check Connection"}
                </button>
              </div>
              {sheetsHealth ? (
                <GoogleSheetsHealthPanel
                  result={sheetsHealth.result}
                  checkedAt={sheetsHealth.checkedAt}
                />
              ) : null}
            </FormSection>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplatesWorkspace({
  templates,
  onChange,
}: {
  templates: TemplateEnv;
  onChange: (t: TemplateEnv) => void;
}) {
  const [shell, setShell] = useState("");
  const [previewMode, setPreviewMode] = useState<"email" | "whatsapp">("email");

  useEffect(() => {
    void fetchEmailShell()
      .then(setShell)
      .catch(() => setShell(""));
  }, []);

  const waPreview = [
    templates.whatsapp_header,
    applyTemplateVars(templates.whatsapp_body, templates),
    templates.whatsapp_footer,
  ]
    .map((part) => applyTemplateVars(part || "", templates).trim())
    .filter(Boolean)
    .join("\n\n");
  const emailHtml = shell
    ? buildEmailPreviewHtml(shell, templates.email_body, templates)
    : applyTemplateVars(templates.email_body, templates);

  return (
    <div className="grid w-full grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <div className="space-y-5 border-b border-[var(--line)] px-4 py-6 sm:px-6 lg:px-8 xl:border-b-0 xl:border-r">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Live WhatsApp and Email send is locked. These editors are for stored templates and
          preview only.
        </p>
        <p className="text-sm text-[var(--muted)]">
          Fixed email chrome comes from <code className="text-[var(--ink)]">thank-you.html</code>.
          Map each {"{{N}}"} token to a Review-page field — on send, the scanned value fills that
          token in email and WhatsApp.
        </p>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Email subject</span>
          <input
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            value={templates.email_subject}
            onChange={(e) => onChange({ ...templates, email_subject: e.target.value })}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Email body content (inside fixed shell)</span>
          <textarea
            rows={16}
            className="w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2.5 font-mono text-[12px] leading-relaxed shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            value={templates.email_body}
            onChange={(e) => onChange({ ...templates, email_body: e.target.value })}
          />
        </label>

        <div className="space-y-4 border-t border-[var(--line)] pt-5">
          <div>
            <p className="text-sm font-medium">WhatsApp message template</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Same structure as Meta Developer: Header (None / Text / Photo / Video / Brochure),
              Body, Footer, optional URL button. Template name and language for production sends
              are configured in the backend environment, not in this CMS form. Header media URL must be publicly reachable (Meta downloads it).
            </p>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Header (optional)</p>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Media sample / header type</span>
              <select
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                value={templates.whatsapp_header_format}
                onChange={(e) =>
                  onChange({
                    ...templates,
                    whatsapp_header_format: e.target.value as WhatsAppHeaderFormat,
                  })
                }
              >
                {WHATSAPP_HEADER_FORMATS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {templates.whatsapp_header_format === "TEXT" ? (
              <label className="mt-3 block text-sm">
                <span className="mb-1.5 block font-medium">Header text</span>
                <input
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                  value={templates.whatsapp_header}
                  onChange={(e) => onChange({ ...templates, whatsapp_header: e.target.value })}
                  placeholder="CardScan Message"
                />
              </label>
            ) : null}

            {templates.whatsapp_header_format === "IMAGE" ||
            templates.whatsapp_header_format === "VIDEO" ||
            templates.whatsapp_header_format === "DOCUMENT" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1.5 block font-medium">
                    {templates.whatsapp_header_format === "IMAGE"
                      ? "Photo / image URL"
                      : templates.whatsapp_header_format === "VIDEO"
                        ? "Video URL"
                        : "Brochure / PDF document URL"}
                  </span>
                  <input
                    className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                    value={templates.whatsapp_header_media_url}
                    onChange={(e) =>
                      onChange({ ...templates, whatsapp_header_media_url: e.target.value })
                    }
                    placeholder={
                      templates.whatsapp_header_format === "DOCUMENT"
                        ? "https://…/brochure.pdf"
                        : templates.whatsapp_header_format === "VIDEO"
                          ? "https://…/intro.mp4"
                          : "https://…/photo.jpg"
                    }
                  />
                </label>
                {templates.whatsapp_header_format === "DOCUMENT" ? (
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1.5 block font-medium">Document filename</span>
                    <input
                      className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                      value={templates.whatsapp_header_media_filename}
                      onChange={(e) =>
                        onChange({
                          ...templates,
                          whatsapp_header_media_filename: e.target.value,
                        })
                      }
                      placeholder="brochure.pdf"
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Body</span>
            <textarea
              rows={8}
              className="w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm leading-relaxed shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              value={templates.whatsapp_body}
              onChange={(e) => onChange({ ...templates, whatsapp_body: e.target.value })}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Footer (optional)</span>
            <input
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              value={templates.whatsapp_footer}
              onChange={(e) => onChange({ ...templates, whatsapp_footer: e.target.value })}
              placeholder="Thank you"
            />
          </label>

          <div className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Buttons (optional)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Button text</span>
                <input
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                  value={templates.whatsapp_button_text}
                  onChange={(e) =>
                    onChange({ ...templates, whatsapp_button_text: e.target.value })
                  }
                  placeholder="Brochure"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Button URL</span>
                <input
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                  value={templates.whatsapp_button_url}
                  onChange={(e) =>
                    onChange({ ...templates, whatsapp_button_url: e.target.value })
                  }
                  placeholder="https://…"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              URL buttons must already exist on the approved Meta template; this stores the
              reference used in preview.
            </p>
          </div>
        </div>

        <TokenMapEditor
          tokenMap={templates.token_map}
          onChange={(token_map) => onChange({ ...templates, token_map })}
        />
      </div>

      <aside className="bg-slate-100/80 px-4 py-6 sm:px-6 lg:px-8 xl:sticky xl:top-0 xl:self-start">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Preview
          </p>
          <div className="inline-flex rounded-lg border border-[var(--line)] bg-white p-0.5">
            <button
              type="button"
              onClick={() => setPreviewMode("email")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                previewMode === "email"
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("whatsapp")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                previewMode === "whatsapp"
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              WhatsApp
            </button>
          </div>
        </div>

        {previewMode === "whatsapp" ? (
          <div className="mx-auto w-full max-w-[320px]">
            <div className="overflow-hidden rounded-[2rem] border-[8px] border-slate-800 bg-[#0b141a] shadow-xl">
              <div className="bg-[#008069] px-4 py-3 text-white">
                <p className="text-[11px] opacity-80">WhatsApp preview</p>
                <p className="truncate text-sm font-semibold">
                  {previewValueForToken(templates, "1") || templates.preview_name || "Contact"}
                </p>
              </div>
              <div className="min-h-[280px] bg-[#0b141a] px-3 py-4">
                <div className="max-w-[85%] rounded-lg rounded-tl-none bg-[#005c4b] px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap text-white shadow">
                  {templates.whatsapp_header_format !== "NONE" ? (
                    <div className="mb-2 overflow-hidden rounded bg-black/25 px-2 py-3 text-center text-[11px] text-white/80">
                      {templates.whatsapp_header_format === "TEXT"
                        ? applyTemplateVars(templates.whatsapp_header, templates) || "Header text"
                        : templates.whatsapp_header_format === "IMAGE"
                          ? "📷 Photo header"
                          : templates.whatsapp_header_format === "VIDEO"
                            ? "🎬 Video header"
                            : "📄 Brochure / PDF header"}
                      {templates.whatsapp_header_media_url ? (
                        <p className="mt-1 truncate text-[10px] text-white/50">
                          {templates.whatsapp_header_media_url}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {waPreview || (
                    <span className="italic text-white/60">Type WhatsApp content…</span>
                  )}
                  {templates.whatsapp_button_text ? (
                    <div className="mt-2 border-t border-white/20 pt-2 text-center text-[12px] font-semibold text-[#53bdeb]">
                      {templates.whatsapp_button_text}
                    </div>
                  ) : null}
                  <div className="mt-1 text-right text-[10px] text-white/60">12:00</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
            <div className="max-h-[70vh] overflow-auto bg-[#eef6f9]">
              {shell ? (
                <iframe
                  title="Email preview"
                  className="h-[70vh] w-full border-0 bg-white"
                  srcDoc={emailHtml}
                />
              ) : (
                <div
                  className="prose prose-sm max-w-none px-4 py-4 text-sm"
                  dangerouslySetInnerHTML={{
                    __html: emailHtml || "<p><em>Loading shell…</em></p>",
                  }}
                />
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function TokenMapEditor({
  tokenMap,
  onChange,
}: {
  tokenMap: Record<string, string>;
  onChange: (map: Record<string, string>) => void;
}) {
  const entries = Object.keys(tokenMap)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)
    .map((n) => String(n));

  const usedFields = new Set(Object.values(tokenMap));

  const setField = (num: string, field: string) => {
    onChange({ ...tokenMap, [num]: field });
  };

  const removeToken = (num: string) => {
    if (entries.length <= 1) return;
    const next = { ...tokenMap };
    delete next[num];
    onChange(next);
  };

  const addToken = () => {
    const nextNum = entries.length
      ? String(Math.max(...entries.map(Number)) + 1)
      : "1";
    const unused = REVIEW_FIELD_OPTIONS.find((o) => !usedFields.has(o.key));
    onChange({
      ...tokenMap,
      [nextNum]: unused?.key || "fullName",
    });
  };

  return (
    <div className="border-t border-[var(--line)] pt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Token → Review field</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Choose which extracted Review field fills each {"{{N}}"} when a card is sent.
          </p>
        </div>
        <button
          type="button"
          onClick={addToken}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-white text-lg font-semibold text-[var(--brand)] shadow-sm hover:bg-slate-50"
          title="Add token"
          aria-label="Add token mapping"
        >
          +
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((num) => (
          <div key={num} className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1.5 block font-medium">{`{{${num}}}`}</span>
              <select
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                value={tokenMap[num] || ""}
                onChange={(e) => setField(num, e.target.value)}
              >
                {REVIEW_FIELD_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={entries.length <= 1}
              onClick={() => removeToken(num)}
              className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] hover:bg-slate-50 hover:text-red-600 disabled:opacity-40"
              title="Remove token"
              aria-label={`Remove {{${num}}}`}
            >
              −
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function googleSheetsCheckLabel(
  value: boolean | null | undefined,
  kind: "auth" | "sheet" | "access" | "write",
  success: boolean,
): string {
  if (kind === "sheet") {
    if (value === true) return "Found";
    if (value === false) return "Not Found";
    return "Not Checked";
  }
  if (kind === "access" || kind === "write") {
    if (value === true) return "Working";
    if (value === false) return "Failed";
    if (kind === "write" && success) return "NOT VERIFIED";
    return "Not Checked";
  }
  if (value === true) return "Connected";
  if (value === false) return "Failed";
  return "Not Checked";
}

function GoogleSheetsHealthPanel({
  result,
  checkedAt,
}: {
  result: GoogleSheetsHealthResult;
  checkedAt: Date;
}) {
  const checks = result.checks || {};
  const ok = Boolean(result.success);
  const rows: { label: string; value: string }[] = [
    {
      label: "Authentication",
      value: googleSheetsCheckLabel(checks.authentication, "auth", ok),
    },
    {
      label: "Spreadsheet Access",
      value: googleSheetsCheckLabel(checks.spreadsheetAccess, "auth", ok),
    },
    {
      label: "Sheet/Tab",
      value: googleSheetsCheckLabel(checks.sheetAccess, "sheet", ok),
    },
    {
      label: "Read Access",
      value: googleSheetsCheckLabel(checks.readAccess, "access", ok),
    },
    {
      label: "Write Access",
      value: googleSheetsCheckLabel(checks.writeAccess, "write", ok),
    },
  ];

  return (
    <div
      className={`mt-4 rounded-md border px-4 py-3 text-sm ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-[var(--danger)]"
      }`}
    >
      <p className="font-semibold">
        {ok ? "✓ Google Sheets Connected" : "✕ Google Sheets Connection Failed"}
      </p>
      {result.spreadsheetName || result.sheet_title ? (
        <p className="mt-1 text-xs opacity-80">
          Spreadsheet: {result.spreadsheetName || result.sheet_title}
        </p>
      ) : null}
      <ul className="mt-3 space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex flex-wrap gap-x-2">
            <span className="font-medium">{row.label}:</span>
            <span>{row.value}</span>
          </li>
        ))}
      </ul>
      {!ok ? (
        <div className="mt-3 whitespace-pre-line text-sm">
          <p className="font-medium">Reason:</p>
          <p>
            {result.reason ||
              result.message ||
              "Please verify your credentials and configuration."}
          </p>
        </div>
      ) : null}
      <p className="mt-3 text-xs opacity-80">
        Last checked: {checkedAt.toLocaleString()}
      </p>
    </div>
  );
}

function FormSection({
  title,
  enabled,
  onEnabledChange,
  locked = false,
  children,
}: {
  title: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {locked ? (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            Locked
          </span>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onEnabledChange(!enabled)}
            className="inline-flex items-center gap-2 text-sm font-medium"
          >
            <span className="text-[var(--muted)]">Enabled</span>
            <span
              className={`relative h-6 w-11 rounded-full transition ${
                enabled ? "bg-[var(--brand)]" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                  enabled ? "translate-x-5" : ""
                }`}
              />
            </span>
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  secret,
  hint,
  multiline,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secret?: boolean;
  hint?: string;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const displayValue = value === "••••••••" ? "" : value;
  const inputPlaceholder =
    placeholder ||
    (secret ? (multiline ? "Paste new JSON to update" : "Enter new value to update") : `Enter ${label.toLowerCase()}`);
  return (
    <label className={`block w-full text-sm ${className || ""}`}>
      <span className="mb-1.5 block font-medium text-[var(--ink)]">{label}</span>
      {multiline ? (
        <textarea
          className="min-h-28 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 font-mono text-xs text-[var(--ink)] shadow-sm placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          value={displayValue}
          placeholder={inputPlaceholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      ) : (
        <input
          type={secret ? "password" : "text"}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)] shadow-sm placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          value={displayValue}
          placeholder={inputPlaceholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
      )}
      {hint ? <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}
