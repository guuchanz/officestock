import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Uploaded files must NOT live under `public/`.
 *
 * `next start` enumerates `public/` once at boot and caches that listing, so a
 * file written there at runtime 404s (returning the HTML error page) until the
 * server is restarted. `next dev` re-checks the filesystem per request, which is
 * why uploads appear to work in development only.
 *
 * Files are therefore stored outside the build directory and served by the
 * route handler at `src/app/uploads/[...path]/route.ts`, which reads from disk
 * on every request. Public URLs stay `/uploads/...` so stored values are
 * unchanged.
 *
 * Set UPLOAD_DIR to an absolute path on a persistent volume in production; the
 * default keeps uploads next to the project but outside `public/`.
 */
export const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "var", "uploads");

/** URL prefix the route handler is mounted at. */
export const UPLOAD_URL_PREFIX = "/uploads";

/**
 * Resolve a public `/uploads/...` path segment list to an absolute path,
 * rejecting anything that escapes UPLOAD_ROOT (e.g. `..` traversal).
 */
export function resolveUploadPath(segments: string[]): string | null {
  const joined = path.join(UPLOAD_ROOT, ...segments);
  const resolved = path.resolve(joined);
  const root = path.resolve(UPLOAD_ROOT);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

/**
 * Write a file into `<UPLOAD_ROOT>/<folder>/` under a random name and return
 * the public URL to serve it from.
 */
export async function saveUpload(
  file: File,
  folder: string,
  ext: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOAD_ROOT, folder);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  return `${UPLOAD_URL_PREFIX}/${folder}/${filename}`;
}

const CONTENT_TYPES: Record<string, string> = {
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif":  "image/gif",
  ".pdf":  "application/pdf",
};

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
