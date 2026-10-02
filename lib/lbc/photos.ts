import fs from "node:fs/promises";
import path from "node:path";
import { photosDir } from "@/lib/paths";
import { USER_AGENT } from "./fetch";

export const MAX_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export function extForContentType(mime: string): string | null {
  return EXT_BY_MIME[mime.toLowerCase()] ?? null;
}

function photoDir(listingId: number): string {
  return path.join(/*turbopackIgnore: true*/ photosDir(), String(listingId));
}

/**
 * Télécharge les photos d'une annonce vers public/photos/<listingId>/.
 * Chaque photo est indépendante : un échec n'empêche pas les autres.
 * Renvoie les chemins publics des photos réellement enregistrées.
 */
export async function downloadPhotos(imageUrls: string[], listingId: number, max = MAX_PHOTOS): Promise<string[]> {
  const dir = photoDir(listingId);
  await fs.mkdir(dir, { recursive: true });
  const saved: string[] = [];
  for (const [i, url] of imageUrls.slice(0, max).entries()) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const mime = res.headers.get("content-type") ?? "";
      if (!mime.startsWith("image/")) continue;
      const ext = extForContentType(mime);
      if (!ext) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) continue;
      await fs.writeFile(path.join(dir, `${i}.${ext}`), buf);
      saved.push(`/photos/${listingId}/${i}.${ext}`);
    } catch {
      // photo ignorée (timeout, erreur réseau…)
    }
  }
  return saved;
}

/** Supprime les photos d'une annonce du disque (appelée quand l'annonce est supprimée). */
export async function removeListingPhotos(listingId: number): Promise<void> {
  await fs.rm(path.join(/*turbopackIgnore: true*/ photosDir(), String(listingId)), {
    recursive: true,
    force: true,
  });
}

/** Enregistre des photos envoyées par formulaire (saisie manuelle). */
export async function saveUploadedPhotos(files: File[], listingId: number, max = MAX_PHOTOS): Promise<string[]> {
  const dir = photoDir(listingId);
  await fs.mkdir(dir, { recursive: true });
  const saved: string[] = [];
  for (const [i, file] of files.slice(0, max).entries()) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size === 0 || file.size > MAX_PHOTO_BYTES) continue;
    const ext = extForContentType(file.type);
    if (!ext) continue;
    await fs.writeFile(path.join(dir, `${i}.${ext}`), Buffer.from(await file.arrayBuffer()));
    saved.push(`/photos/${listingId}/${i}.${ext}`);
  }
  return saved;
}
