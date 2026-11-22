"use client";

import { useAction, useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@nl-convex/_generated/api";
import type { Id } from "@nl-convex/_generated/dataModel";
import { CONVEX_URL } from "../../lib/config";

/** True for images already stored in this newsletter's Convex storage. */
export function isStoredImage(src: string): boolean {
  return !!CONVEX_URL && src.startsWith(`${CONVEX_URL.replace(/\/+$/, "")}/api/storage/`);
}

/** Uploading files, and copying images from other sites, into Convex storage. */
export function useImageStore() {
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const urlFor = useMutation(api.media.urlFor);
  const importFromUrl = useAction(api.media.importFromUrl);

  const upload = useCallback(
    async (blob: Blob): Promise<{ storageId: Id<"_storage">; url: string }> => {
      if (!blob.type.startsWith("image/")) throw new Error("That file isn't an image.");
      if (blob.size > 15 * 1024 * 1024) throw new Error("That image is over 15 MB.");
      const target = await generateUploadUrl();
      const res = await fetch(target, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      return { storageId, url: await urlFor({ storageId }) };
    },
    [generateUploadUrl, urlFor],
  );

  /** Store any image src: data: and blob: URLs are uploaded, web images imported. */
  const store = useCallback(
    async (src: string): Promise<string> => {
      if (src.startsWith("data:") || src.startsWith("blob:")) {
        const blob = await (await fetch(src)).blob();
        return (await upload(blob)).url;
      }
      return (await importFromUrl({ url: src })).url;
    },
    [upload, importFromUrl],
  );

  return { upload, store };
}
