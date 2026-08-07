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
  saveAdminEnv,
  SECRET_EMAIL,
  SECRET_WHATSAPP,
  WHATSAPP_FIELD_LABELS,
  WHATSAPP_INPUT_KEYS,
  type AdminEnvRow,
  type EmailEnv,
  type TemplateEnv,
  type WhatsAppEnv,
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
            Admin environment
          </h1>
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
          className={`w-full border-b px-4 py-2.5 text-sm sm:px-6 lg:px-8 ${
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
              Admins
            </p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {loading ? "Loading…" : `${admins.length} account${admins.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="max-h-[40vh] overflow-y-auto lg:max-h-[calc(100vh-7.5rem)]">
            {loading ? (
              <p className="px-4 py-8 text-sm text-[var(--muted)]">Loading admins…</p>
            ) : admins.length === 0 ? (
              <div className="px-4 py-8 text-sm text-[var(--muted)] sm:px-5">
                <p className="font-medium text-[var(--ink)]">No Admins yet</p>
                <p className="mt-2 leading-relaxed">
                  Create an Admin in the main app (Manage Team). After they accept the invite,
                  refresh here to configure their WhatsApp and Email env.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {admins.map((admin) => {
                  const active = admin.admin_id === selectedId;
                  return (
                    <li key={admin.admin_id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(admin.admin_id)}
                        className={`w-full px-4 py-3.5 text-left transition sm:px-5 ${
                          active
                            ? "border-l-4 border-l-[var(--brand)] bg-[var(--brand-soft)]/50"
                            : "border-l-4 border-l-transparent hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-[var(--ink)]">
                            {displayName(admin)}
                          </span>
                          <StatusDot
                            ok={admin.is_active}
                            title={admin.is_active ? "Active" : "Inactive"}
                          />
                        </div>
                        <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{admin.email}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {admin.company_name ? (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                              {admin.company_name}
                            </span>
                          ) : null}
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                              admin.has_settings
                                ? "bg-teal-100 text-teal-800"
                                : "bg-amber-50 text-amber-800"
                            }`}
                          >
                            {admin.has_settings ? "Env saved" : "Env empty"}
                          </span>
                        </div>
                      </button>
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

function StatusDot({ ok, title }: { ok: boolean; title: string }) {
  return (
    <span
      title={title}
      className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
        ok ? "bg-emerald-500" : "bg-slate-300"
      }`}
    />
  );
}

function AdminEnvEditor({
  admin,
  onSaved,
  onError,
}: {
  admin: AdminEnvRow;
  onSaved: (row: AdminEnvRow) => void;
  onError: (text: string) => void;
}) {
  const [whatsapp, setWhatsapp] = useState<WhatsAppEnv>(admin.whatsapp);
  const [emailEnv, setEmailEnv] = useState<EmailEnv>(admin.emailEnv);
  const [templates, setTemplates] = useState<TemplateEnv>(admin.templates);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<"whatsapp" | "email" | "templates">("templates");

  useEffect(() => {
    setWhatsapp(admin.whatsapp);
    setEmailEnv(admin.emailEnv);
    setTemplates(admin.templates);
    setSection("templates");
  }, [admin]);

  const save = async () => {
    setSaving(true);
    try {
      const next = await saveAdminEnv(admin.admin_id, {
        whatsapp,
        email: emailEnv,
        templates,
      });
      onSaved(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex w-full flex-col gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">{displayName(admin)}</h2>
          <p className="mt-1 truncate text-sm text-[var(--muted)]">
            {admin.email}
            {admin.company_name ? ` · ${admin.company_name}` : ""}
            {admin.phone ? ` · ${admin.phone}` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="shrink-0 rounded-md bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-ink)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="w-full border-b border-[var(--line)] bg-[var(--surface)] px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              ["templates", "Templates & preview"],
              ["whatsapp", "WhatsApp env"],
              ["email", "Email env"],
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
        {section === "templates" ? (
          <TemplatesWorkspace
            templates={templates}
            onChange={setTemplates}
          />
        ) : section === "whatsapp" ? (
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <FormSection
              title="WhatsApp environment"
              enabled={whatsapp.enabled}
              onEnabledChange={(enabled) => setWhatsapp((w) => ({ ...w, enabled }))}
            >
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {WHATSAPP_INPUT_KEYS.map((key) => (
                  <Field
                    key={key}
                    label={WHATSAPP_FIELD_LABELS[key] || key}
                    secret={SECRET_WHATSAPP.has(key)}
                    hint={
                      key === "access_token" && whatsapp.access_token_set
                        ? "Saved — leave blank to keep"
                        : key === "permanent_token" && whatsapp.permanent_token_set
                          ? "Saved — leave blank to keep"
                          : undefined
                    }
                    value={String(whatsapp[key] ?? "")}
                    onChange={(v) => setWhatsapp((w) => ({ ...w, [key]: v }))}
                  />
                ))}
              </div>
            </FormSection>
          </div>
        ) : (
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <FormSection
              title="Email environment"
              enabled={emailEnv.enabled}
              onEnabledChange={(enabled) => setEmailEnv((em) => ({ ...em, enabled }))}
            >
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {EMAIL_INPUT_KEYS.map((key) => (
                  <Field
                    key={key}
                    label={EMAIL_FIELD_LABELS[key] || key}
                    secret={SECRET_EMAIL.has(key)}
                    hint={
                      key === "smtp_password" && emailEnv.smtp_password_set
                        ? "Saved — leave blank to keep"
                        : key === "api_key" && emailEnv.api_key_set
                          ? "Saved — leave blank to keep"
                          : undefined
                    }
                    value={String(emailEnv[key] ?? "")}
                    onChange={(v) => setEmailEnv((em) => ({ ...em, [key]: v }))}
                  />
                ))}
              </div>
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

  const waPreview = applyTemplateVars(templates.whatsapp_body, templates);
  const emailHtml = shell
    ? buildEmailPreviewHtml(shell, templates.email_body, templates)
    : applyTemplateVars(templates.email_body, templates);

  return (
    <div className="grid w-full grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <div className="space-y-5 border-b border-[var(--line)] px-4 py-6 sm:px-6 lg:px-8 xl:border-b-0 xl:border-r">
        <p className="text-sm text-[var(--muted)]">
          Fixed email chrome comes from <code className="text-[var(--ink)]">thank-you.html</code>.
          Edit only the body content below. Tokens: {"{{1}}"} name, {"{{2}}"} phone, {"{{3}}"} email,{" "}
          {"{{4}}"} website, {"{{5}}"} sign-off.
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

        <div className="border-t border-[var(--line)] pt-5">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">WhatsApp message content</span>
            <textarea
              rows={5}
              className="w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm leading-relaxed shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              value={templates.whatsapp_body}
              onChange={(e) => onChange({ ...templates, whatsapp_body: e.target.value })}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="{{1}} Name"
            value={templates.preview_name}
            onChange={(v) => onChange({ ...templates, preview_name: v })}
          />
          <Field
            label="{{2}} Phone"
            value={templates.preview_phone}
            onChange={(v) => onChange({ ...templates, preview_phone: v })}
          />
          <Field
            label="{{3}} Email"
            value={templates.preview_email}
            onChange={(v) => onChange({ ...templates, preview_email: v })}
          />
          <Field
            label="{{4}} Website"
            value={templates.preview_website}
            onChange={(v) => onChange({ ...templates, preview_website: v })}
          />
          <Field
            label="{{5}} Sign-off"
            value={templates.preview_signoff}
            onChange={(v) => onChange({ ...templates, preview_signoff: v })}
          />
          <Field
            label="Event / company sample"
            value={templates.preview_company}
            onChange={(v) => onChange({ ...templates, preview_company: v })}
          />
        </div>
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
                  {templates.preview_name || "Contact"}
                </p>
              </div>
              <div className="min-h-[280px] bg-[#0b141a] px-3 py-4">
                <div className="max-w-[85%] rounded-lg rounded-tl-none bg-[#005c4b] px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap text-white shadow">
                  {waPreview || (
                    <span className="italic text-white/60">Type WhatsApp content…</span>
                  )}
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

function FormSection({
  title,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secret?: boolean;
  hint?: string;
}) {
  return (
    <label className="block w-full text-sm">
      <span className="mb-1.5 block font-medium text-[var(--ink)]">{label}</span>
      <input
        type={secret ? "password" : "text"}
        className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)] shadow-sm placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        value={value === "••••••••" ? "" : value}
        placeholder={secret ? "Enter new value to update" : `Enter ${label.toLowerCase()}`}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {hint ? <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}
