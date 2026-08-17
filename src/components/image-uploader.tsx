"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { downscaleImage } from "@/lib/downscale-image";
import { cn } from "@/lib/cn";

/**
 * Direct-to-ImageKit (or local /api/upload fallback) image uploader with a
 * simple percent progress bar. Images are downscaled client-side first.
 */
export function ImageUploader({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = preview ?? value;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    let blob: Blob;
    try {
      blob = await downscaleImage(file);
    } catch {
      setError("Couldn't read that image.");
      return;
    }

    setPreview(URL.createObjectURL(blob));

    let target:
      | { mode: "imagekit"; url: string; fields: Record<string, string> }
      | { mode: "local"; url: string };
    try {
      const authRes = await fetch("/api/imagekit-auth");
      if (authRes.ok) {
        const auth = await authRes.json();
        target = {
          mode: "imagekit",
          url: "https://upload.imagekit.io/api/v1/files/upload",
          fields: {
            publicKey: auth.publicKey,
            signature: auth.signature,
            expire: String(auth.expire),
            token: auth.token,
            folder: auth.folder,
            fileName: "product.jpg",
            useUniqueFileName: "true",
          },
        };
      } else {
        target = { mode: "local", url: "/api/upload" };
      }
    } catch {
      setError("Network error.");
      setPreview(null);
      return;
    }

    const form = new FormData();
    if (target.mode === "imagekit") {
      for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
    }
    form.append("file", blob, "upload.jpg");

    const xhr = new XMLHttpRequest();
    setPercent(0);
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      setPercent(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onerror = () => {
      setPercent(null);
      setPreview(null);
      setError("Upload failed.");
    };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.url) {
          setPercent(null);
          onChange(res.url);
          return;
        }
        throw new Error(res.error ?? "Upload failed");
      } catch (err) {
        setPercent(null);
        setPreview(null);
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    };
    xhr.open("POST", target.url);
    xhr.send(form);
  }

  const uploading = percent !== null;

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-muted">{label}</p>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          className={cn(
            "relative block aspect-square w-24 shrink-0 overflow-hidden rounded-2xl border border-dashed border-border bg-surface-2 transition-all duration-200 hover:border-primary/50 active:scale-[0.98]",
          )}
        >
          {shown ? (
            <Image
              src={shown}
              alt="Preview"
              fill
              unoptimized={shown.startsWith("blob:")}
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-1 text-xs text-faint">
              <span className="text-xl">🖼️</span>
              Add
            </span>
          )}
          {uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-bold text-white">
              {percent}%
            </span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          {shown && !uploading ? (
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                onChange(null);
              }}
              className="text-xs font-medium text-muted transition-colors hover:text-live"
            >
              Remove
            </button>
          ) : !uploading ? (
            <p className="text-xs text-faint">JPEG, PNG or WebP.</p>
          ) : null}
          {error ? <p className="mt-1 text-xs text-live">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
