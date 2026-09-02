import { useEffect, useState } from "react";
import {
  checkAdminEnvironment,
  fetchAdminTestUsers,
  formatEnvironmentCheckMessage,
  saveAdminTestUsersLimit,
  setTenantUserScanEntitlement,
  DEFAULT_SCAN_CARD_LIMIT,
  type AdminEnvRow,
  type EnvironmentCheckResult,
  type ScanEntitlementMode,
  type TestUsersSummary,
} from "@/lib/cmsApi";

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function StatusMark({ ok, label }: { ok: boolean | null | undefined; label: string }) {
  const text =
    ok === true ? "✓" : ok === false ? "✕" : "–";
  const color =
    ok === true
      ? "text-emerald-700"
      : ok === false
        ? "text-[var(--danger)]"
        : "text-[var(--muted)]";
  return (
    <span className={color}>
      {text} {label}
    </span>
  );
}

export function EnvironmentOverviewPanel({
  admin,
  onRefreshAdmin,
  onOk,
  onError,
}: {
  admin: AdminEnvRow;
  onRefreshAdmin: (next: AdminEnvRow) => void;
  onOk: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [envResult, setEnvResult] = useState<EnvironmentCheckResult | null>(null);
  const [testUsers, setTestUsers] = useState<TestUsersSummary | null>(null);
  const [testLimit, setTestLimit] = useState(String(admin.test_users_limit ?? 0));
  const [savingLimit, setSavingLimit] = useState(false);
  const [checkingUsers, setCheckingUsers] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingPremiumUserId, setSavingPremiumUserId] = useState<string | null>(null);
  const [customLimitDraft, setCustomLimitDraft] = useState<Record<string, string>>({});

  const env = admin.environment;
  const cmsVersion = admin.config_version ?? env?.cms_version ?? 0;
  const projectVersion = admin.project_config_version ?? env?.project_version ?? null;

  useEffect(() => {
    setTestLimit(String(admin.test_users_limit ?? 0));
    setEnvResult(null);
    setLoadingUsers(true);
    void fetchAdminTestUsers(admin.admin_id)
      .then(setTestUsers)
      .catch(() => setTestUsers(null))
      .finally(() => setLoadingUsers(false));
  }, [admin.admin_id, admin.test_users_limit, admin.settings_updated_at]);

  const runEnvCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await checkAdminEnvironment(admin.admin_id);
      setEnvResult(res);
      const detail = formatEnvironmentCheckMessage(res);
      if (res.success) onOk(detail);
      else onError(detail);
      // Refresh list metadata (version/sync) from parent reload path:
      onRefreshAdmin({
        ...admin,
        sync_status: res.sync_status || admin.sync_status,
        config_version: res.versions?.cms ?? admin.config_version,
        project_config_version:
          res.versions?.project ?? admin.project_config_version ?? null,
        last_health_at: res.checked_at || admin.last_health_at,
        environment: {
          stored: Boolean(res.configuration?.stored ?? admin.has_settings),
          connected: Boolean(res.success),
          sync_status: res.sync_status || (res.success ? "connected" : "failed"),
          cms_version: res.versions?.cms ?? cmsVersion,
          project_version: res.versions?.project ?? projectVersion,
          synchronized: Boolean(res.versions?.synchronized),
          last_updated: admin.settings_updated_at,
          last_checked: res.checked_at || null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Environment check failed";
      onError(`✕ Environment Connection Failed\n\nReason: ${msg}`);
    } finally {
      setChecking(false);
    }
  };

  const saveLimit = async () => {
    const n = Number(testLimit);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      onError("Test users limit must be a number between 0 and 100.");
      return;
    }
    setSavingLimit(true);
    try {
      const res = await saveAdminTestUsersLimit(admin.admin_id, Math.floor(n));
      setTestUsers(res);
      onRefreshAdmin({ ...admin, test_users_limit: res.configured });
      onOk(`Test user configuration saved: ${res.configured} configured.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save test users limit");
    } finally {
      setSavingLimit(false);
    }
  };

  const runUserCheck = async () => {
    if (checkingUsers) return;
    setCheckingUsers(true);
    try {
      const refreshed = await fetchAdminTestUsers(admin.admin_id);
      setTestUsers(refreshed);
      const active = refreshed.active ?? 0;
      const connected = refreshed.connected ?? 0;
      const total = refreshed.total ?? refreshed.users.length;
      onOk(`✓ Users\n\n${active} active · ${connected} connected of ${total}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "User check failed");
    } finally {
      setCheckingUsers(false);
    }
  };

  const entitlementLabel = (mode?: ScanEntitlementMode, limit?: number | null) => {
    if (mode === "unlimited") return "Unlimited";
    if (mode === "custom" && limit != null) return `${limit} cards`;
    return `${DEFAULT_SCAN_CARD_LIMIT} cards (default)`;
  };

  const saveScanEntitlement = async (
    userId: string,
    mode: ScanEntitlementMode,
    limit?: number | null,
  ) => {
    if (savingPremiumUserId) return;
    setSavingPremiumUserId(userId);
    try {
      const res = await setTenantUserScanEntitlement(admin.admin_id, userId, mode, limit);
      setTestUsers(res.users);
      const email = res.user?.email || userId;
      onOk(`Scan limit updated for ${email}: ${entitlementLabel(mode, res.user_card_limit ?? limit ?? null)}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update scan limit");
    } finally {
      setSavingPremiumUserId(null);
    }
  };

  const onEntitlementSelect = (userId: string, value: string) => {
    if (value === "default" || value === "unlimited") {
      void saveScanEntitlement(userId, value);
      return;
    }
    if (value === "500") {
      void saveScanEntitlement(userId, "custom", 500);
      return;
    }
    if (value === "custom") {
      setCustomLimitDraft((prev) => ({
        ...prev,
        [userId]: prev[userId] ?? "",
      }));
    }
  };

  const integ = envResult?.integrations;
  const lastHealthIntegrations =
    admin.last_health && typeof admin.last_health === "object"
      ? (admin.last_health.integrations as Record<string, { status?: string }> | undefined)
      : undefined;
  const integrationSource = integ || lastHealthIntegrations || {};
  const sheets = admin.googleSheets;
  const sheetsConfigured = Boolean(
    sheets?.google_sheet_id ||
      sheets?.google_service_account_json_set ||
      sheets?.google_oauth_client_id,
  );
  const sheetsHealth = Object.entries(integrationSource).find(([key]) =>
    /google|sheets/i.test(key),
  )?.[1] as { status?: string } | undefined;
  const sheetsConnected = sheetsHealth?.status === "pass";
  const sheetsStatusLabel = sheetsConnected
    ? "· Connected"
    : sheetsConfigured || sheets?.enabled
      ? "· Configured"
      : "· Not connected";
  const activeUsers =
    testUsers?.active ??
    (testUsers?.users || []).filter((u) => u.is_active || u.status === "Active").length;
  const connectedUsers =
    testUsers?.connected ??
    (testUsers?.users || []).filter((u) => u.connected || u.check_status === "pass").length;
  const totalUsers = testUsers?.total ?? (testUsers?.users || []).length;

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-md border border-[var(--line)] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">Environment Overview</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Tenant: {admin.company_name || admin.email} · {admin.tenant_id}
            </p>
          </div>
          <button
            type="button"
            disabled={checking}
            onClick={() => void runEnvCheck()}
            className="shrink-0 rounded-md border border-[var(--brand)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] shadow-sm hover:bg-[var(--brand-soft)]/40 disabled:opacity-50"
          >
            {checking ? "Checking Environment…" : "Check Environment Connection"}
          </button>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Only <strong>Google Sheets</strong> has access. WhatsApp and Email are locked.
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3">
            <dt className="text-emerald-800">Google Sheets</dt>
            <dd className="mt-1 font-semibold text-emerald-900">
              Has access
              <span className="ml-2 font-medium">{sheetsStatusLabel}</span>
            </dd>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
            <dt className="text-amber-800">WhatsApp</dt>
            <dd className="mt-1 font-semibold text-amber-900">Locked · No access</dd>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
            <dt className="text-amber-800">Email</dt>
            <dd className="mt-1 font-semibold text-amber-900">Locked · No access</dd>
          </div>
        </dl>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md border border-[var(--line)] px-3 py-3">
            <dt className="text-[var(--muted)]">Users active</dt>
            <dd className="mt-1 text-lg font-semibold">
              {loadingUsers ? "…" : activeUsers}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--line)] px-3 py-3">
            <dt className="text-[var(--muted)]">Users connected</dt>
            <dd className="mt-1 text-lg font-semibold">
              {loadingUsers ? "…" : connectedUsers}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--line)] px-3 py-3">
            <dt className="text-[var(--muted)]">Users total</dt>
            <dd className="mt-1 text-lg font-semibold">
              {loadingUsers ? "…" : totalUsers}
            </dd>
          </div>
        </dl>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-[var(--muted)]">CMS Configuration</dt>
            <dd className="mt-0.5 font-medium">
              <StatusMark ok={admin.has_settings} label={admin.has_settings ? "Stored" : "Missing"} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Project Environment</dt>
            <dd className="mt-0.5 font-medium">
              <StatusMark
                ok={env?.connected ?? (admin.sync_status === "connected")}
                label={
                  env?.connected || admin.sync_status === "connected"
                    ? "Connected"
                    : admin.has_settings
                      ? "Not Connected"
                      : "Missing"
                }
              />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Configuration Version</dt>
            <dd className="mt-0.5 font-medium">
              CMS v{cmsVersion || "—"} · Project v{projectVersion ?? "—"}
              <span className="ml-2 text-xs text-[var(--muted)]">
                {env?.synchronized || (projectVersion != null && projectVersion === cmsVersion)
                  ? "✓ Synchronized"
                  : admin.has_settings
                    ? "⚠ Sync pending / check required"
                    : ""}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Last Updated</dt>
            <dd className="mt-0.5 font-medium">{formatWhen(admin.settings_updated_at)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Last Checked</dt>
            <dd className="mt-0.5 font-medium">
              {formatWhen(envResult?.checked_at || admin.last_health_at)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Environment Health</dt>
            <dd className="mt-0.5 font-medium">
              <StatusMark
                ok={envResult ? envResult.success : admin.sync_status === "connected"}
                label={
                  envResult
                    ? envResult.success
                      ? "Healthy"
                      : "Failed"
                    : admin.sync_status === "connected"
                      ? "Healthy"
                      : "Unknown"
                }
              />
            </dd>
          </div>
        </dl>

        {Object.keys(integrationSource).length > 0 ? (
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <p className="text-sm font-medium">Integrations</p>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(integrationSource).map(([key, val]) => {
                if (/^(whatsapp|email)$/i.test(key) || /whatsapp|smtp/i.test(key)) {
                  return (
                    <li key={key} className="text-amber-800">
                      🔒 {key}: Locked
                    </li>
                  );
                }
                const status = String(
                  (val as { status?: string } | undefined)?.status || "disabled",
                );
                const ok =
                  status === "pass" ? true : status === "fail" ? false : null;
                const label =
                  status === "disabled"
                    ? "Disabled / Not Configured"
                    : status === "pass"
                      ? "Working"
                      : status === "warn"
                        ? "Warning"
                        : "Failed";
                return (
                  <li key={key}>
                    <StatusMark ok={ok} label={`${key}: ${label}`} />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Save channel settings, then run Check Environment Connection to verify project
            runtime loading.
          </p>
        )}

        {envResult && !envResult.success ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            <p className="font-medium">Reason</p>
            <p className="mt-1 whitespace-pre-line">
              {envResult.reason || envResult.message}
            </p>
            {envResult.action ? <p className="mt-2">{envResult.action}</p> : null}
          </div>
        ) : null}

        {envResult?.success ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Environment data is stored in CMS and successfully connected to the project
            environment.
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-[var(--line)] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">Users</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Tenant users for this client. Grant premium (unlimited card scans) to selected
              people only — other users in the same company keep Freemium limits.
            </p>
          </div>
          <button
            type="button"
            disabled={checkingUsers || loadingUsers}
            onClick={() => void runUserCheck()}
            className="shrink-0 rounded-md border border-[var(--brand)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] shadow-sm hover:bg-[var(--brand-soft)]/40 disabled:opacity-50"
          >
            {checkingUsers ? "Checking Users…" : "Check Users"}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Number of Test Users</span>
            <input
              type="number"
              min={0}
              max={100}
              className="w-40 rounded-md border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              value={testLimit}
              onChange={(e) => setTestLimit(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={savingLimit}
            onClick={() => void saveLimit()}
            className="rounded-md bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-ink)] disabled:opacity-50"
          >
            {savingLimit ? "Saving…" : "Save Test User Configuration"}
          </button>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[var(--muted)]">Active</dt>
            <dd className="font-medium">
              {loadingUsers ? "…" : (testUsers?.active ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Connected</dt>
            <dd className="font-medium">
              {loadingUsers ? "…" : (testUsers?.connected ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Total</dt>
            <dd className="font-medium">
              {loadingUsers ? "…" : (testUsers?.total ?? testUsers?.users.length ?? 0)}
            </dd>
          </div>
        </dl>

        {testUsers?.note ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{testUsers.note}</p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Active</th>
                <th className="py-2 pr-4 font-medium">Connected</th>
                <th className="py-2 pr-4 font-medium">Scan limit</th>
                <th className="py-2 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {(testUsers?.users || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-[var(--muted)]">
                    {loadingUsers
                      ? "Loading users…"
                      : "No Admin or User accounts under this tenant yet."}
                  </td>
                </tr>
              ) : (
                (testUsers?.users || []).map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-[var(--muted)]">{u.email}</div>
                    </td>
                    <td className="py-2.5 pr-4">{u.role}</td>
                    <td className="py-2.5 pr-4">
                      {u.is_active || u.status === "Active" ? "✓ Active" : "Inactive"}
                    </td>
                    <td className="py-2.5 pr-4">
                      {u.connected || u.check_status === "pass"
                        ? "✓ Connected"
                        : "Not connected"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex min-w-[220px] flex-col gap-2">
                        <select
                          className="rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
                          disabled={savingPremiumUserId === u.id}
                          value={
                            u.scan_entitlement_mode === "custom" &&
                            u.user_card_limit != null &&
                            u.user_card_limit !== 500
                              ? "custom"
                              : u.scan_entitlement_mode === "custom" && u.user_card_limit === 500
                                ? "500"
                                : u.scan_entitlement_mode || "default"
                          }
                          onChange={(e) => onEntitlementSelect(u.id, e.target.value)}
                        >
                          <option value="default">{DEFAULT_SCAN_CARD_LIMIT} cards (default)</option>
                          <option value="unlimited">Unlimited</option>
                          <option value="500">500 cards</option>
                          <option value="custom">Custom…</option>
                        </select>
                        {(u.scan_entitlement_mode === "custom" &&
                          u.user_card_limit != null &&
                          u.user_card_limit !== 500) ||
                        customLimitDraft[u.id] !== undefined ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={100000}
                              className="w-24 rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs"
                              placeholder="Limit"
                              value={
                                customLimitDraft[u.id] ??
                                (u.user_card_limit != null && u.user_card_limit !== 500
                                  ? String(u.user_card_limit)
                                  : "")
                              }
                              onChange={(e) =>
                                setCustomLimitDraft((prev) => ({
                                  ...prev,
                                  [u.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                              disabled={savingPremiumUserId === u.id}
                              onClick={() => {
                                const n = Number(customLimitDraft[u.id] ?? u.user_card_limit);
                                if (!Number.isFinite(n) || n < 1) {
                                  onError("Enter a custom limit of at least 1.");
                                  return;
                                }
                                void saveScanEntitlement(u.id, "custom", Math.floor(n));
                                setCustomLimitDraft((prev) => {
                                  const next = { ...prev };
                                  delete next[u.id];
                                  return next;
                                });
                              }}
                            >
                              Save
                            </button>
                          </div>
                        ) : null}
                        <span className="text-[11px] text-[var(--muted)]">
                          {savingPremiumUserId === u.id
                            ? "Saving…"
                            : u.scan_entitlement_mode === "custom"
                              ? `${u.user_cards_used ?? 0} / ${u.user_card_limit ?? "—"} used`
                              : entitlementLabel(u.scan_entitlement_mode, u.user_card_limit ?? null)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5">{formatWhen(u.last_login || u.last_test)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
