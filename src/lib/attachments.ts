/**
 * Pairing logic for multi-file uploads that carry a name per file.
 *
 * Lives outside the `"use server"` action module for two reasons: such a
 * module may only export async functions, and this is the piece most worth
 * testing directly — an off-by-one here silently attaches the right files
 * under the wrong names, which no type check would catch.
 */

export interface PendingAttachment {
  file: File;
  docName: string;
}

export const MAX_DOC_NAME = 191;

/**
 * Zips `files[i]` with `names[i]`.
 *
 * Empty files are dropped *after* zipping, never before: filtering first
 * would shift every later name onto the wrong file. A blank or missing name
 * falls back to the original filename so the label is never empty.
 */
export function pairFilesWithNames(
  files: readonly unknown[],
  names: readonly unknown[]
): PendingAttachment[] {
  return files
    .map((file, i) => ({
      file,
      docName: typeof names[i] === "string" ? (names[i] as string).trim() : "",
    }))
    .filter(
      (a): a is { file: File; docName: string } =>
        a.file instanceof File && a.file.size > 0
    )
    .map((a) => ({
      file: a.file,
      docName: (a.docName || a.file.name).slice(0, MAX_DOC_NAME),
    }));
}
