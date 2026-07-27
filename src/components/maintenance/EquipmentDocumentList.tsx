import { FileText, Image as ImageIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

export interface DocumentListItem {
  id: number;
  docName: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  createdAt: Date;
}

/**
 * Read-only document list for the equipment detail page.
 *
 * Deliberately a server component with no client JS: opening a file is just a
 * link. Upload, rename and delete live on the edit page (see
 * `EquipmentDocuments`), so the detail page stays a viewing surface.
 */
export default async function EquipmentDocumentList({
  documents,
}: {
  documents: DocumentListItem[];
}) {
  const t = await getTranslations("EquipmentDocuments");

  if (documents.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{t("empty")}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {documents.map((doc) => (
        <li key={doc.id}>
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
          >
            {doc.mimeType === "application/pdf"
              ? <FileText size={16} className="shrink-0 text-slate-400" />
              : <ImageIcon size={16} className="shrink-0 text-slate-400" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-blue-600">
                {doc.docName || doc.fileName}
              </span>
              <span className="block truncate text-[11px] text-slate-400">
                {doc.fileName} · {new Date(doc.createdAt).toLocaleDateString("th-TH")}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
