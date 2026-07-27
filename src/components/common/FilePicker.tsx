"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";

/**
 * Multi-file picker that collects a name for each selected file.
 *
 * Shared by Repair attachments and Quotation files.
 *
 * The hidden `docNames` inputs are rendered in the same order as the FileList,
 * so the server can zip `getAll("files")[i]` with `getAll("docNames")[i]`.
 * Removing a file rebuilds the FileList via DataTransfer rather than just
 * hiding a row — otherwise the removed file would still be submitted and the
 * names would shift onto the wrong files.
 */
interface Props {
  /** MIME whitelist for the file input; must match the server-side check. */
  accept?: string;
  /** Hint shown under the picker when nothing is selected yet. */
  hint?: string;
}

export default function FilePicker({
  accept = "application/pdf",
  hint,
}: Props) {
  const t = useTranslations("Attachments");
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [names, setNames] = useState<string[]>([]);

  function sync(next: File[], nextNames: string[]) {
    const dt = new DataTransfer();
    for (const f of next) dt.items.add(f);
    if (inputRef.current) inputRef.current.files = dt.files;
    setFiles(next);
    setNames(nextNames);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    // Append to what is already staged so a second "choose files" does not
    // silently discard the first batch.
    const next = [...files, ...picked];
    const nextNames = [...names, ...picked.map((f) => f.name)];
    sync(next, nextNames);
  }

  function removeAt(i: number) {
    sync(files.filter((_, k) => k !== i), names.filter((_, k) => k !== i));
  }

  function renameAt(i: number, value: string) {
    setNames((prev) => prev.map((n, k) => (k === i ? value : n)));
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        name="files"
        type="file"
        multiple
        accept={accept}
        className="input"
        onChange={onPick}
      />

      {files.length > 0 && (
        <ul className="space-y-2 rounded-lg border border-slate-200 p-3">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2">
              {f.type === "application/pdf"
                ? <FileText size={15} className="shrink-0 text-slate-400" />
                : <ImageIcon size={15} className="shrink-0 text-slate-400" />}

              <span className="w-40 shrink-0 truncate text-xs text-slate-400" title={f.name}>
                {f.name}
              </span>

              <input
                name="docNames"
                className="input flex-1 py-1.5"
                value={names[i] ?? ""}
                onChange={(e) => renameAt(i, e.target.value)}
                placeholder={t("docNamePlaceholder")}
                aria-label={t("docNameLabel")}
              />

              <button
                type="button"
                onClick={() => removeAt(i)}
                className="p-1 text-slate-400 hover:text-red-600"
                title={t("removeFile")}
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Paperclip size={12} />
        {files.length > 0 ? t("filesSelected", { count: files.length }) : hint ?? t("hint")}
      </p>
    </div>
  );
}
