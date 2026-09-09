import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteCmsMedia,
  emailImgTag,
  fetchCmsMedia,
  uploadCmsMedia,
  type CmsMediaItem,
} from "@/lib/cmsApi";

type Props = {
  adminId: string;
  onInsertEmailImg: (html: string) => void;
  onUseMediaUrl: (url: string, filename: string, kind: CmsMediaItem["kind"]) => void;
  onOk?: (text: string) => void;
  onError?: (text: string) => void;
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function previewSrc(item: CmsMediaItem): string {
  // Prefer same-origin /assets path so Vite proxy serves local uploads in preview.
  const url = item.url || "";
  const marker = "/assets/";
  const idx = url.indexOf(marker);
  if (idx !== -1) return url.slice(idx);
  if (item.relative_path) return `/assets/${item.relative_path.replace(/^\/+/, "")}`;
  return url;
}

export function CmsMediaLibrary({
  adminId,
  onInsertEmailImg,
  onUseMediaUrl,
  onOk,
  onError,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<CmsMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchCmsMedia(adminId);
      setItems(next);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to load media library");
    } finally {
      setLoading(false);
    }
  }, [adminId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPick = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const item = await uploadCmsMedia(adminId, file);
      setItems((prev) => [item, ...prev.filter((x) => x.filename !== item.filename)]);
      onOk?.(`Uploaded ${item.filename}`);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      onOk?.("URL copied");
    } catch {
      onError?.("Could not copy URL");
    }
  };

  const onDelete = async (item: CmsMediaItem) => {
    if (!window.confirm(`Delete ${item.filename} from the media library?`)) return;
    setBusyId(item.id);
    try {
      await deleteCmsMedia(adminId, item.filename);
      setItems((prev) => prev.filter((x) => x.filename !== item.filename));
      onOk?.(`Deleted ${item.filename}`);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Media library</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Upload banners, logos, videos, or PDFs once. Insert into the email body or use as
            WhatsApp header media. JPEG, PNG, WebP, GIF, MP4, PDF · max 25 MB.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.mp4,.pdf"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-[var(--brand)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-ink)] shadow-sm hover:bg-[var(--brand-soft)]/40 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload media"}
          </button>
          <button
            type="button"
            disabled={loading || uploading}
            onClick={() => void load()}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Loading media…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-slate-50/80 px-3 py-6 text-center text-sm text-[var(--muted)]">
          No media yet. Upload a banner or logo to start.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const src = previewSrc(item);
            return (
              <li
                key={item.id}
                className="overflow-hidden rounded-md border border-[var(--line)] bg-slate-50/60"
              >
                <div className="flex h-28 items-center justify-center bg-slate-100/80">
                  {item.kind === "image" ? (
                    <img src={src} alt={item.filename} className="h-full w-full object-contain" />
                  ) : item.kind === "video" ? (
                    <span className="text-xs font-semibold text-[var(--muted)]">VIDEO · MP4</span>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--muted)]">PDF document</span>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div>
                    <p className="truncate text-xs font-semibold text-[var(--ink)]" title={item.filename}>
                      {item.filename}
                    </p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {item.kind} · {formatBytes(item.size)}
                    </p>
                    <p className="mt-1 truncate font-mono text-[10px] text-[var(--muted)]" title={item.url}>
                      {item.url}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.kind === "image" ? (
                      <button
                        type="button"
                        onClick={() => onInsertEmailImg(emailImgTag(item.url, item.filename))}
                        className="rounded border border-[var(--brand)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-soft)]/40"
                      >
                        Insert in email
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onUseMediaUrl(item.url, item.filename, item.kind)}
                      className="rounded border border-[var(--line)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--ink)] hover:bg-slate-50"
                    >
                      Use for WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => void onCopy(item.url)}
                      className="rounded border border-[var(--line)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--ink)] hover:bg-slate-50"
                    >
                      Copy URL
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void onDelete(item)}
                      className="rounded border border-red-200 bg-white px-2 py-1 text-[10px] font-semibold text-[var(--danger)] hover:bg-red-50 disabled:opacity-50"
                    >
                      {busyId === item.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
