import { useEffect, useRef, useState } from "react";
import {
  checkAdminEnvironment,
  fetchAdminTestUsers,
  formatEnvironmentCheckMessage,
  saveAdminChannelLocks,
  saveAdminReceiveEmail,
  saveAdminEmailDisplayName,
  saveAdminDisplayName,
  saveAdminDisplayPicture,
  saveAdminTestUsersLimit,
  setTenantUserScanEntitlement,
  DEFAULT_SCAN_CARD_LIMIT,
  type AdminEnvRow,
  type ChannelLocks,
  type EnvironmentCheckResult,
  type ScanEntitlementMode,
  type TestUsersSummary,
} from "@/lib/cmsApi";

const DISPLAY_PICTURE_MAX_BYTES = 5 * 1024 * 1024;
const DISPLAY_PICTURE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

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
  const [savingLock, setSavingLock] = useState<keyof ChannelLocks | null>(null);
  const [receiveEmail, setReceiveEmail] = useState(admin.receive_email || "");
  const [savingReceive, setSavingReceive] = useState(false);
  const [emailDisplayName, setEmailDisplayName] = useState(admin.email_display_name || "");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayName, setDisplayName] = useState(admin.display_name || "");
  const [savingBusinessDisplayName, setSavingBusinessDisplayName] = useState(false);
  const [displayPictureUrl, setDisplayPictureUrl] = useState(admin.display_picture_url || "");
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [savingPicture, setSavingPicture] = useState(false);
  const pictureInputRef = useRef<HTMLInputElement>(null);

  const env = admin.environment;
  const locks = admin.channel_locks || {
    whatsapp: true,
    email: false,
    google_sheets: false,
  };
  const cmsVersion = admin.config_version ?? env?.cms_version ?? 0;
  const projectVersion = admin.project_config_version ?? env?.project_version ?? null;

  useEffect(() => {
    setTestLimit(String(admin.test_users_limit ?? 0));
    setReceiveEmail(admin.receive_email || admin.emailEnv?.sender_notification_email || "");
    setEmailDisplayName(admin.email_display_name || "");
    setDisplayName(admin.display_name || "");
    setDisplayPictureUrl(admin.display_picture_url || "");
    setPictureFile(null);
    setPicturePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setEnvResult(null);
    setLoadingUsers(true);
    void fetchAdminTestUsers(admin.admin_id)
      .then(setTestUsers)
      .catch(() => setTestUsers(null))
      .finally(() => setLoadingUsers(false));
  }, [
    admin.admin_id,
    admin.test_users_limit,
    admin.settings_updated_at,
    admin.receive_email,
    admin.emailEnv?.sender_notification_email,
    admin.email_display_name,
    admin.display_name,
    admin.company_name,
    admin.display_picture_url,
  ]);

  useEffect(() => {
    return () => {
      if (picturePreview) URL.revokeObjectURL(picturePreview);
    };
  }, [picturePreview]);

  const runEnvCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await checkAdminEnvironment(admin.admin_id);
      setEnvResult(res);
      const detail = formatEnvironmentCheckMessage(res);
      if (res.success) onOk(detail);
      else onError(detail);
      onRefreshAdmin({
        ...admin,
        sync_status: res.sync_status || admin.sync_status,
        config_version: res.versions?.cms ?? admin.config_version,
        project_config_version:
          res.versions?.project ?? admin.project_config_version ?? null,
        last_health_at: res.checked_at || admin.last_health_at,
        last_health: {
          ...(admin.last_health && typeof admin.last_health === "object"
            ? admin.last_health
            : {}),
          integrations: res.integrations || {},
          checks: res.checks || {},
          whatsapp_runtime: res.whatsapp_runtime || null,
          success: res.success,
        },
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

  const toggleChannelLock = async (channel: keyof ChannelLocks) => {
    if (savingLock) return;
    const nextLocked = !locks[channel];
    setSavingLock(channel);
    try {
      const next = await saveAdminChannelLocks(admin.admin_id, { [channel]: nextLocked });
      onRefreshAdmin(next);
      const label =
        channel === "google_sheets"
          ? "Google Sheets"
          : channel === "whatsapp"
            ? "WhatsApp"
            : "Email";
      onOk(
        nextLocked
          ? `🔒 ${label} locked — turned off for this company in the app.`
          : `✓ ${label} unlocked — available again for this company in the app.`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update channel lock");
    } finally {
      setSavingLock(null);
    }
  };

  const saveReceiveEmail = async () => {
    if (savingReceive) return;
    const value = receiveEmail.trim();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      onError("Enter a valid Receive email address.");
      return;
    }
    setSavingReceive(true);
    try {
      const next = await saveAdminReceiveEmail(admin.admin_id, value);
      setReceiveEmail(next.receive_email || value);
      onRefreshAdmin(next);
      onOk(
        value
          ? `Receive email saved: ${value}`
          : "Receive email cleared — fallback hierarchy will be used.",
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save Receive email");
    } finally {
      setSavingReceive(false);
    }
  };

  const saveEmailDisplayName = async () => {
    if (savingDisplayName) return;
    const value = emailDisplayName.trim();
    if (value.length > 255) {
      onError("Email Display Name must be 255 characters or fewer.");
      return;
    }
    setSavingDisplayName(true);
    try {
      const next = await saveAdminEmailDisplayName(admin.admin_id, value);
      setEmailDisplayName(next.email_display_name ?? value);
      onRefreshAdmin(next);
      onOk(
        value
          ? `Email Display Name saved: ${value}`
          : "Email Display Name cleared — default From name will be used.",
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save Email Display Name");
    } finally {
      setSavingDisplayName(false);
    }
  };

  const saveBusinessDisplayName = async () => {
    if (savingBusinessDisplayName) return;
    const value = displayName.trim();
    if (value.length > 255) {
      onError("Display Name must be 255 characters or fewer.");
      return;
    }
    setSavingBusinessDisplayName(true);
    try {
      const { item } = await saveAdminDisplayName(admin.admin_id, value);
      setDisplayName(item.display_name || value);
      onRefreshAdmin(item);
      onOk(
        value
          ? `Display Name saved for this Admin account: ${value}`
          : "Display Name cleared for this Admin account.",
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save Display Name");
    } finally {
      setSavingBusinessDisplayName(false);
    }
  };

  const onPickPicture = (file: File | null) => {
    setPicturePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPictureFile(null);
    if (!file) return;
    const type = (file.type || "").toLowerCase();
    if (!DISPLAY_PICTURE_TYPES.has(type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      onError("Invalid image format. Use JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > DISPLAY_PICTURE_MAX_BYTES) {
      onError("Image must be 5 MB or smaller.");
      return;
    }
    setPictureFile(file);
    setPicturePreview(URL.createObjectURL(file));
  };

  const saveProfilePicture = async () => {
    if (savingPicture) return;
    if (!pictureFile) {
      onError("Choose an image with Upload Picture before saving.");
      return;
    }
    setSavingPicture(true);
    try {
      const { item } = await saveAdminDisplayPicture(
        admin.admin_id,
        pictureFile,
      );
      setDisplayPictureUrl(item.display_picture_url || "");
      setPictureFile(null);
      setPicturePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (pictureInputRef.current) pictureInputRef.current.value = "";
      onRefreshAdmin(item);
      onOk("Profile picture saved for this Admin account only.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save profile picture");
    } finally {
      setSavingPicture(false);
    }
  };

  const integ = envResult?.integrations;
  const lastHealthIntegrations =
    admin.last_health && typeof admin.last_health === "object"
      ? (admin.last_health.integrations as
          | Record<string, { status?: string; message?: string }>
          | undefined)
      : undefined;
  const integrationSource = integ || lastHealthIntegrations || {};
  const waBridge =
    envResult?.whatsapp_runtime ||
    (admin.last_health && typeof admin.last_health === "object"
      ? (admin.last_health as { whatsapp_runtime?: EnvironmentCheckResult["whatsapp_runtime"] })
          .whatsapp_runtime
      : undefined);
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
              Tenant: {admin.display_name || admin.company_name || admin.email} ·{" "}
              {admin.tenant_id}
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

        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          Click <strong>Lock</strong> / <strong>Unlock</strong> on each channel to turn it off or on
          for this company&apos;s users in the main app. Email SMTP still uses server{" "}
          <code className="text-[var(--ink)]">.env</code> when unlocked.
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div
            className={`rounded-md border px-3 py-3 ${
              locks.google_sheets
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <dt className={locks.google_sheets ? "text-amber-800" : "text-emerald-800"}>
              Google Sheets
            </dt>
            <dd
              className={`mt-1 font-semibold ${
                locks.google_sheets ? "text-amber-900" : "text-emerald-900"
              }`}
            >
              {locks.google_sheets ? "Locked · No access" : "Has access"}
              {!locks.google_sheets ? (
                <span className="ml-2 font-medium">{sheetsStatusLabel}</span>
              ) : null}
            </dd>
            <dd className="mt-3">
              <button
                type="button"
                disabled={savingLock !== null}
                onClick={() => void toggleChannelLock("google_sheets")}
                className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {savingLock === "google_sheets"
                  ? "Saving…"
                  : locks.google_sheets
                    ? "Unlock"
                    : "Lock"}
              </button>
            </dd>
          </div>
          <div
            className={`rounded-md border px-3 py-3 ${
              locks.whatsapp ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <dt className={locks.whatsapp ? "text-amber-800" : "text-emerald-800"}>WhatsApp</dt>
            <dd
              className={`mt-1 font-semibold ${
                locks.whatsapp ? "text-amber-900" : "text-emerald-900"
              }`}
            >
              {locks.whatsapp ? "Locked · No access" : "Unlocked · Available"}
            </dd>
            <dd className="mt-3">
              <button
                type="button"
                disabled={savingLock !== null}
                onClick={() => void toggleChannelLock("whatsapp")}
                className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {savingLock === "whatsapp" ? "Saving…" : locks.whatsapp ? "Unlock" : "Lock"}
              </button>
            </dd>
          </div>
          <div
            className={`rounded-md border px-3 py-3 ${
              locks.email ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
            }`}
          >
            <dt className={locks.email ? "text-amber-800" : "text-slate-700"}>
              Email (Amazon SES)
            </dt>
            <dd
              className={`mt-1 font-semibold ${
                locks.email ? "text-amber-900" : "text-slate-900"
              }`}
            >
              {locks.email ? "Locked · No access" : "Unlocked · Server .env"}
              {!locks.email ? (
                <span className="ml-2 text-xs font-normal text-slate-600">
                  INTERNAL + EXTERNAL lanes
                </span>
              ) : null}
            </dd>
            <dd className="mt-3">
              <button
                type="button"
                disabled={savingLock !== null}
                onClick={() => void toggleChannelLock("email")}
                className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {savingLock === "email" ? "Saving…" : locks.email ? "Unlock" : "Lock"}
              </button>
            </dd>
          </div>
        </dl>

        <div className="mt-4 rounded-md border border-[var(--line)] bg-white px-3 py-3">
          <label className="block text-sm">
            <span className="font-semibold text-[var(--ink)]">Receive email</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Not hardcoded. Whatever you save here is the inbox that receives scanned contact
              details for this Admin&apos;s company (Admin + User scans). Super Admin scans still
              use the Super Admin login / SUPERADMIN_EMAIL default.
            </span>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="email"
                value={receiveEmail}
                onChange={(e) => setReceiveEmail(e.target.value)}
                placeholder="manager@company.com"
                className="w-full flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              />
              <button
                type="button"
                disabled={savingReceive}
                onClick={() => void saveReceiveEmail()}
                className="shrink-0 rounded-md border border-[var(--brand)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] shadow-sm hover:bg-[var(--brand-soft)]/40 disabled:opacity-50"
              >
                {savingReceive ? "Saving…" : "Save receive email"}
              </button>
            </div>
          </label>
        </div>

        <div className="mt-4 rounded-md border border-[var(--line)] bg-white px-3 py-3">
          <label className="block text-sm">
            <span className="font-semibold text-[var(--ink)]">Email Display Name</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Set the display name that recipients will see when emails are received from this
              Admin Company. The From email address stays the same.
            </span>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={emailDisplayName}
                onChange={(e) => setEmailDisplayName(e.target.value)}
                placeholder={admin.company_name || "ABC Company"}
                maxLength={255}
                className="w-full flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              />
              <button
                type="button"
                disabled={savingDisplayName}
                onClick={() => void saveEmailDisplayName()}
                className="shrink-0 rounded-md border border-[var(--brand)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] shadow-sm hover:bg-[var(--brand-soft)]/40 disabled:opacity-50"
              >
                {savingDisplayName ? "Saving…" : "Save"}
              </button>
            </div>
          </label>
        </div>

        <div className="mt-4 rounded-md border border-[var(--line)] bg-white px-3 py-3">
          <label className="block text-sm">
            <span className="font-semibold text-[var(--ink)]">Display Name</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Profile display name for this Admin account only (stored on their user_id). Other
              Admins and Users keep their own names.
            </span>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={
                  `${admin.first_name || ""} ${admin.last_name || ""}`.trim() ||
                  admin.company_name ||
                  "John"
                }
                maxLength={255}
                className="w-full flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm shadow-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              />
              <button
                type="button"
                disabled={savingBusinessDisplayName}
                onClick={() => void saveBusinessDisplayName()}
                className="shrink-0 rounded-md border border-[var(--brand)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] shadow-sm hover:bg-[var(--brand-soft)]/40 disabled:opacity-50"
              >
                {savingBusinessDisplayName ? "Saving…" : "Save"}
              </button>
            </div>
          </label>
        </div>

        <div className="mt-4 rounded-md border border-[var(--line)] bg-white px-3 py-3">
          <div className="text-sm">
            <span className="font-semibold text-[var(--ink)]">Display Picture (Profile Picture)</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Profile picture for this Admin account only (stored under
              profile-pictures/&#123;user_id&#125;/). JPEG, PNG, or WebP · max 5 MB. Does not change other
              accounts.
            </span>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--line)] bg-slate-50">
                {picturePreview || displayPictureUrl ? (
                  <img
                    src={picturePreview || displayPictureUrl}
                    alt="Current profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-2 text-center text-xs text-[var(--muted)]">
                    Current Profile Picture / Logo
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  ref={pictureInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => onPickPicture(e.target.files?.[0] || null)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => pictureInputRef.current?.click()}
                    className="rounded-md border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] shadow-sm hover:bg-slate-50"
                  >
                    Upload Picture
                  </button>
                  {picturePreview ? (
                    <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
                      Preview ready
                    </span>
                  ) : null}
                </div>
                {pictureFile ? (
                  <p className="text-xs text-[var(--muted)]">
                    Selected: {pictureFile.name} ({Math.ceil(pictureFile.size / 1024)} KB)
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={savingPicture || !pictureFile}
                  onClick={() => void saveProfilePicture()}
                  className="w-fit rounded-md border border-[var(--brand)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] shadow-sm hover:bg-[var(--brand-soft)]/40 disabled:opacity-50"
                >
                  {savingPicture ? "Saving…" : "Save Profile Picture"}
                </button>
              </div>
            </div>
          </div>
        </div>

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
                if (/^email$/i.test(key) || /smtp/i.test(key)) {
                  const status = String(
                    (val as { status?: string; message?: string } | undefined)?.status ||
                      "disabled",
                  );
                  const msg = (val as { message?: string } | undefined)?.message;
                  return (
                    <li key={key} className="text-slate-700">
                      {key}: {status}
                      {msg ? ` — ${msg}` : " (server .env)"}
                    </li>
                  );
                }
                const status = String(
                  (val as { status?: string; message?: string } | undefined)?.status ||
                    "disabled",
                );
                const msg = (val as { message?: string } | undefined)?.message;
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
                    {msg ? (
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">{msg}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {waBridge ? (
              <div
                className={`mt-4 rounded-md border px-3 py-3 text-sm ${
                  waBridge.uses_cms_credentials && !waBridge.channel_locked
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <p className="font-semibold">WhatsApp ↔ main app</p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  <li>
                    CMS credentials used at send time:{" "}
                    {waBridge.uses_cms_credentials ? "yes" : "no (server .env fallback)"}
                  </li>
                  <li>Channel locked: {waBridge.channel_locked ? "yes" : "no"}</li>
                  <li>
                    Credentials complete: {waBridge.credentials_complete ? "yes" : "no"}
                  </li>
                  {waBridge.template ? <li>Template: {waBridge.template}</li> : null}
                </ul>
              </div>
            ) : null}
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
