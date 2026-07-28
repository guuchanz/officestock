import PDFDocument from "pdfkit";
import { THAI_FONT, splitRuns, drawText } from "./reportExport";
import type { ProjectDetail } from "@/actions/project.actions";

/**
 * One-project document (name, details, timeline, update log, files) — not a
 * row-per-project table, so this doesn't reuse `buildPdfReport`. Wraps
 * mixed Thai/Latin text itself: the Sarabun "thai" subset has no Latin
 * glyphs, so a single `doc.font()` can't render "PJ-2026-001 เปลี่ยนแอร์" in
 * one call, and pdfkit's built-in wrapping only ever uses one font per call.
 */

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const thDate = (d: Date | null) => (d ? d.toLocaleDateString("th-TH") : "-");

/**
 * Splits into breakable tokens: Latin/digit runs break on spaces (normal
 * word wrap), Thai runs break per character, since Thai text has no spaces
 * between words. This can split a syllable mid-word — an accepted
 * simplification; true Thai line-breaking needs dictionary segmentation.
 */
function tokenize(str: string): { text: string; thai: boolean }[] {
  const tokens: { text: string; thai: boolean }[] = [];
  for (const run of splitRuns(str)) {
    if (run.thai) {
      for (const ch of Array.from(run.text)) tokens.push({ text: ch, thai: true });
    } else {
      for (const part of run.text.match(/\s+|\S+/g) ?? []) {
        tokens.push({ text: part, thai: false });
      }
    }
  }
  return tokens;
}

/** Draws a left-aligned, word-wrapped paragraph; returns the y after it. */
function drawWrapped(
  doc: PDFKit.PDFDocument,
  str: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number
): number {
  let cx = x;
  let cy = y;
  for (const tok of tokenize(str)) {
    doc.font(tok.thai ? "thai" : "Helvetica");
    const w = doc.widthOfString(tok.text);
    if (cx + w > x + width && cx > x) {
      cx = x;
      cy += lineHeight;
    }
    if (cx === x && tok.text.trim() === "") continue; // no leading space on a new line
    doc.text(tok.text, cx, cy, { lineBreak: false });
    cx += w;
  }
  return cy + lineHeight;
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed <= doc.page.height - doc.page.margins.bottom) return y;
  doc.addPage();
  return doc.page.margins.top;
}

function sectionHeading(doc: PDFKit.PDFDocument, title: string, y: number): number {
  y = ensureSpace(doc, y, 30);
  doc.fontSize(13).fillColor("#1e3a5f").font("Helvetica-Bold");
  doc.text(title, doc.page.margins.left, y);
  doc.font("Helvetica");
  y += 18;
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor("#ccc").stroke();
  return y + 10;
}

export async function buildProjectSummaryPdf(project: ProjectDetail): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.registerFont("thai", THAI_FONT);

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;

  // --- Title: code + name -----------------------------------------------
  doc.fontSize(10).fillColor("#666").font("Helvetica");
  doc.text(project.code, left, y);
  y += 16;
  doc.fontSize(18).fillColor("#000");
  y = drawWrapped(doc, project.name, left, y, width, 24);
  y += 6;

  // --- Meta grid: two columns of key/value pairs -------------------------
  const meta: [string, string][] = [
    ["Department", project.departmentName ?? "-"],
    ["Requestor", project.requestor ?? "-"],
    ["Owner", project.ownerName ?? "-"],
    ["Status", project.status],
    ["Priority", project.priority],
    ["Progress", `${project.progress}%`],
    ["Start Date", thDate(project.startDate)],
    ["Due Date", thDate(project.dueDate)],
    ["Finished", thDate(project.finishedAt)],
    ["Budget", money(project.budget)],
    ["Actual Cost", money(project.actualCost)],
    ["Variance", money(project.budget - project.actualCost)],
  ];
  const colWidth = width / 2;
  doc.fontSize(9);
  for (let i = 0; i < meta.length; i += 2) {
    y = ensureSpace(doc, y, 16);
    for (let c = 0; c < 2; c++) {
      const pair = meta[i + c];
      if (!pair) continue;
      const x = left + c * colWidth;
      doc.fillColor("#666").font("Helvetica").text(`${pair[0]}:`, x, y, { continued: false });
      doc.fillColor("#000");
      drawText(doc, pair[1], x + 85, y, colWidth - 85, "left");
    }
    y += 16;
  }
  y += 10;

  // --- Details -------------------------------------------------------------
  if (project.details) {
    y = sectionHeading(doc, "Details", y);
    doc.fontSize(10).fillColor("#000");
    y = drawWrapped(doc, project.details, left, y, width, 15);
    y += 10;
  }

  // --- Timeline (milestones) ------------------------------------------------
  y = sectionHeading(doc, "Timeline", y);
  doc.fontSize(9);
  if (project.milestones.length === 0) {
    doc.fillColor("#999").text("No milestones yet", left, y);
    y += 16;
  } else {
    const nameW = width * 0.45;
    const dateW = width * 0.35;
    const statusW = width - nameW - dateW;
    for (const m of project.milestones) {
      y = ensureSpace(doc, y, 16);
      const dates = m.startDate && m.endDate
        ? `${thDate(m.startDate)} - ${thDate(m.endDate)}`
        : "No dates set";
      doc.fillColor("#000");
      drawText(doc, m.name, left, y, nameW, "left");
      doc.fillColor("#666");
      drawText(doc, dates, left + nameW, y, dateW, "left");
      doc.fillColor(m.isDone ? "#059669" : "#999");
      drawText(doc, m.isDone ? "Done" : "Pending", left + nameW + dateW, y, statusW, "left");
      y += 16;
    }
  }
  y += 10;

  // --- Update Log ------------------------------------------------------------
  y = sectionHeading(doc, "Update Log", y);
  doc.fontSize(9);
  if (project.updates.length === 0) {
    doc.fillColor("#999").text("No updates yet", left, y);
    y += 16;
  } else {
    for (const u of project.updates) {
      y = ensureSpace(doc, y, 40);
      doc.fillColor("#666");
      const head = u.cost > 0
        ? `${thDate(u.createdAt)} - ${u.authorName} - ${money(u.cost)}`
        : `${thDate(u.createdAt)} - ${u.authorName}`;
      drawText(doc, head, left, y, width, "left");
      y += 14;
      doc.fillColor("#000");
      y = drawWrapped(doc, u.note, left, y, width, 13);
      if (u.attachments.length > 0) {
        doc.fillColor("#666");
        for (const a of u.attachments) {
          y = ensureSpace(doc, y, 13);
          drawText(doc, `- ${a.docName || a.fileName}`, left + 10, y, width - 10, "left");
          y += 13;
        }
      }
      y += 8;
    }
  }
  y += 6;

  // --- Files (project-level documents) ----------------------------------------
  y = sectionHeading(doc, "Files", y);
  doc.fontSize(9);
  if (project.files.length === 0) {
    doc.fillColor("#999").text("No files attached", left, y);
  } else {
    for (const f of project.files) {
      y = ensureSpace(doc, y, 14);
      doc.fillColor("#000");
      drawText(doc, `- ${f.docName || f.fileName}`, left, y, width, "left");
      y += 14;
    }
  }

  doc.end();
  return done;
}
