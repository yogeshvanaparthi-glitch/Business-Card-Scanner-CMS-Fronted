import { useState } from "react";
import {
  inspectAdminWhatsApp,
  subscribeAdminWhatsAppWebhook,
  type WhatsAppCheckStatus,
  type WhatsAppEnv,
  type WhatsAppInspectResult,
} from "@/lib/cmsApi";

const STATUS_STYLES: Record<WhatsAppCheckStatus, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
  skip: "border-slate-200 bg-slate-50 text-slate-700",
};

const STATUS_DOT: Record<WhatsAppCheckStatus, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  error: "bg-red-500",
  skip: "bg-slate-400",
};

const OVERALL_LABEL: Record<WhatsAppCheckStatus, string> = {
  ok: "Ready",
  warn: "Needs attention",
  error: "Not ready",
  skip: "Incomplete",
};

type Props = {
  adminId: string;
  whatsapp: WhatsAppEnv;
  onError: (message: string) => void;
  onOk: (message: string) => void;
};

export function WhatsAppSetupPanel({ adminId, whatsapp, onError, onOk }: Props) {
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [report, setReport] = useState<WhatsAppInspectResult | null>(null);

  const runInspect = async () => {
    setLoading(true);
    try {
      const result = await inspectAdminWhatsApp(adminId, whatsapp);
      setReport(result);
      if (result.overall === "ok") {
        onOk("WhatsApp setup looks good. Review the checklist below.");
      } else if (result.overall === "error") {
        onError("WhatsApp setup has blocking issues. See checklist below.");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Status check failed");
    } finally {
      setLoading(false);
    }
  };

  const runSubscribe = async () => {
    setSubscribing(true);
    try {
      const result = await subscribeAdminWhatsAppWebhook(adminId, whatsapp);
      onOk(
        result.action === "already_subscribed"
          ? "Webhooks already subscribed for this WABA."
          : "Subscribed app to WABA webhooks successfully.",
      );
      await runInspect();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Webhook subscribe failed");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--ink)]">WhatsApp setup checker</h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Check verification, templates, and webhooks from CMS — no need to open Meta Developer
            settings for routine checks. Uses saved credentials plus any unsaved form values you
            typed (secrets left blank keep saved values).
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runInspect()}
            className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Checking…" : "Check status"}
          </button>
          <button
            type="button"
            disabled={subscribing || loading}
            onClick={() => void runSubscribe()}
            className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-50"
          >
            {subscribing ? "Subscribing…" : "Subscribe webhooks"}
          </button>
        </div>
      </div>

      {report ? (
        <div className="mt-5 space-y-5">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${STATUS_STYLES[report.overall]}`}
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[report.overall]}`} />
            Overall: {OVERALL_LABEL[report.overall]} ({report.summary.checks_ok}/
            {report.summary.checks_total} passed)
          </div>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-[var(--ink)]">Checklist</h4>
            <ul className="space-y-2">
              {report.checklist.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-lg border px-3 py-2.5 text-sm ${STATUS_STYLES[item.status]}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[item.status]}`} />
                    <div className="min-w-0">
                      <p className="font-medium">{item.label}</p>
                      <p className="mt-0.5 opacity-90">{item.detail}</p>
                      {item.fix ? (
                        <p className="mt-1 text-xs opacity-80">
                          <span className="font-medium">Fix:</span> {item.fix}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {report.phone ? (
            <InfoGrid
              title="Phone number (Meta)"
              rows={[
                ["Display", String(report.phone.display_phone_number ?? "—")],
                ["Verified name", String(report.phone.verified_name ?? "—")],
                ["Status", String(report.phone.status ?? "—")],
                ["Name approval", String(report.phone.name_status ?? "—")],
                ["Account mode", String(report.phone.account_mode ?? "—")],
                ["Quality", String(report.phone.quality_rating ?? "—")],
              ]}
            />
          ) : null}

          {report.waba ? (
            <InfoGrid
              title="WhatsApp Business Account"
              rows={[
                ["Name", String(report.waba.name ?? "—")],
                ["Review status", String(report.waba.account_review_status ?? "—")],
                ["Template namespace", String(report.waba.message_template_namespace ?? "—")],
              ]}
            />
          ) : null}

          {report.configured_templates && report.configured_templates.length > 0 ? (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-[var(--ink)]">CMS templates in Meta</h4>
              <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Use</th>
                      <th className="px-3 py-2 font-medium">CMS name</th>
                      <th className="px-3 py-2 font-medium">Language</th>
                      <th className="px-3 py-2 font-medium">Meta status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.configured_templates.map((row) => (
                      <tr key={`${row.label}-${row.configured_name}`} className="border-t border-[var(--line)]">
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.configured_name}</td>
                        <td className="px-3 py-2">{row.meta_language || row.configured_language}</td>
                        <td className="px-3 py-2">
                          <StatusPill
                            status={row.approved ? "ok" : row.found ? "warn" : "error"}
                            label={row.meta_status || (row.found ? "found" : "not found")}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {report.waba_phones && report.waba_phones.length > 0 ? (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-[var(--ink)]">Numbers on this WABA</h4>
              <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Display</th>
                      <th className="px-3 py-2 font-medium">Phone number ID</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.waba_phones.map((row) => (
                      <tr key={String(row.id)} className="border-t border-[var(--line)]">
                        <td className="px-3 py-2">{String(row.display_phone_number ?? "—")}</td>
                        <td className="px-3 py-2 font-mono text-xs">{String(row.id ?? "—")}</td>
                        <td className="px-3 py-2">{String(row.status ?? "—")}</td>
                        <td className="px-3 py-2">{String(row.verified_name ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {report.templates && report.templates.length > 0 ? (
            <details className="rounded-lg border border-[var(--line)] bg-slate-50/50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-[var(--ink)]">
                All Meta templates ({report.templates.length})
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto text-xs text-[var(--muted)]">
                {report.templates.map((tpl) => (
                  <div key={`${tpl.name}-${tpl.language}`} className="border-t border-[var(--line)] py-1.5 first:border-t-0">
                    <span className="font-mono text-[var(--ink)]">{tpl.name}</span> · {tpl.language} ·{" "}
                    {tpl.status}
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {report.still_requires_meta_console && report.still_requires_meta_console.length > 0 ? (
            <section className="rounded-lg border border-dashed border-[var(--line)] bg-slate-50 px-3 py-3 text-sm text-[var(--muted)]">
              <p className="font-medium text-[var(--ink)]">Still done once in Meta (cannot automate)</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {report.still_requires_meta_console.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-3 text-[var(--brand)]">
                {report.meta_console_links?.whatsapp_manager ? (
                  <a
                    href={report.meta_console_links.whatsapp_manager}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    WhatsApp Manager
                  </a>
                ) : null}
                {report.meta_console_links?.api_setup ? (
                  <a href={report.meta_console_links.api_setup} target="_blank" rel="noreferrer" className="underline">
                    API Setup
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Click <strong>Check status</strong> to verify phone connection, display name approval, token
          expiry, template approval, and webhook subscription.
        </p>
      )}
    </div>
  );
}

function InfoGrid({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-[var(--ink)]">{title}</h4>
      <dl className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--line)] bg-slate-50/60 p-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-[var(--muted)]">{label}</dt>
            <dd className="text-sm font-medium text-[var(--ink)]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function StatusPill({ status, label }: { status: WhatsAppCheckStatus; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}
