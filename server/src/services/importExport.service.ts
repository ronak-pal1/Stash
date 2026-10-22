import archiver from "archiver";
import { parse } from "node-html-parser";
import PDFDocument from "pdfkit";
import { PassThrough } from "node:stream";
import { badRequest } from "../libs/apiError.js";
import { docToHtml, docToMarkdown, markdownToDoc, textToDoc, type JSONContent } from "../utils/content.js";
import { requireNote, requireWorkspace } from "./access.service.js";
import { createNote, presentNote } from "./note.service.js";

export interface ImportReport {
  created: number;
  failed: Array<{ file: string; message: string }>;
  notes: ReturnType<typeof presentNote>[];
}

const htmlToDoc = (html: string): JSONContent => {
  const root = parse(html);
  const content: JSONContent[] = [];
  for (const node of root.querySelectorAll("h1, h2, h3, p, li, blockquote")) {
    const text = node.text.trim();
    if (!text) continue;
    if (node.tagName === "H1" || node.tagName === "H2" || node.tagName === "H3") {
      content.push({ type: "heading", attrs: { level: Number(node.tagName[1]) }, content: [{ type: "text", text }] });
    } else if (node.tagName === "BLOCKQUOTE") {
      content.push({ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
    } else if (node.tagName === "LI") {
      content.push({ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }] });
    } else {
      content.push({ type: "paragraph", content: [{ type: "text", text }] });
    }
  }
  if (content.length === 0) content.push({ type: "paragraph", content: [{ type: "text", text: root.text.trim() }] });
  return { type: "doc", content };
};

const enexToDocs = (xml: string): Array<{ title: string; content: JSONContent }> => {
  const notes: Array<{ title: string; content: JSONContent }> = [];
  const chunks = xml.split("<note>").slice(1);
  for (const chunk of chunks) {
    const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(chunk)?.[1]?.trim() || "Imported note";
    const body = /<content>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/.exec(chunk)?.[1] ?? "";
    notes.push({ title, content: htmlToDoc(body) });
  }
  return notes;
};

export const importFile = async (userId: string, userName: string, workspaceId: string, folderId: string | null, file: Express.Multer.File): Promise<ImportReport> => {
  await requireWorkspace(userId, workspaceId);
  const name = file.originalname.toLowerCase();
  const text = file.buffer.toString("utf8");
  const report: ImportReport = { created: 0, failed: [], notes: [] };
  try {
    const docs: Array<{ title: string; content: JSONContent; tags?: string[] }> = [];
    if (name.endsWith(".json")) {
      const parsed = JSON.parse(text) as { format?: string; notes?: Array<{ title?: string; content?: JSONContent; tags?: string[] }>; note?: { title?: string; content?: JSONContent; tags?: string[] } };
      const list = parsed.notes ?? (parsed.note ? [parsed.note] : []);
      if (list.length === 0) throw badRequest("JSON export did not contain notes");
      for (const item of list) docs.push({ title: item.title ?? "Imported", content: item.content ?? textToDoc(""), tags: item.tags });
    } else if (name.endsWith(".enex") || text.includes("<en-export")) {
      docs.push(...enexToDocs(text));
    } else if (name.endsWith(".html") || name.endsWith(".htm")) {
      docs.push({ title: file.originalname.replace(/\.[^.]+$/, ""), content: htmlToDoc(text) });
    } else if (name.endsWith(".md")) {
      const title = /^#\s+(.+)$/m.exec(text)?.[1] ?? file.originalname.replace(/\.[^.]+$/, "");
      docs.push({ title, content: markdownToDoc(text) });
    } else {
      docs.push({ title: file.originalname.replace(/\.[^.]+$/, ""), content: textToDoc(text) });
    }
    for (const doc of docs) {
      const note = await createNote(userId, userName, { workspaceId, folderId, title: doc.title, content: doc.content, tags: doc.tags });
      report.notes.push(note);
      report.created += 1;
    }
  } catch (error) {
    report.failed.push({ file: file.originalname, message: error instanceof Error ? error.message : "Import failed" });
  }
  return report;
};

export const exportNote = async (userId: string, noteId: string, format: "md" | "html" | "json" | "pdf") => {
  const { note } = await requireNote(userId, noteId);
  const title = note.title || "Untitled";
  if (format === "md") return { filename: `${title}.md`, mime: "text/markdown", body: Buffer.from(`# ${title}\n\n${docToMarkdown(note.content as JSONContent)}`) };
  if (format === "html") return { filename: `${title}.html`, mime: "text/html", body: Buffer.from(`<!doctype html><title>${title}</title>${docToHtml(note.content as JSONContent)}`) };
  if (format === "json") {
    return {
      filename: `${title}.json`,
      mime: "application/json",
      body: Buffer.from(JSON.stringify({ format: "stash-note", version: 1, note: presentNote(note) })),
    };
  }
  const pdf = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(22).text(title);
    doc.moveDown();
    doc.fontSize(11).text(note.plainText || "", { align: "left" });
    doc.end();
  });
  return { filename: `${title}.pdf`, mime: "application/pdf", body: pdf };
};

export const exportBulk = async (userId: string, workspaceId: string, noteIds: string[], format: "md" | "html" | "json") => {
  await requireWorkspace(userId, workspaceId);
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    archive.on("error", reject);
  });
  archive.pipe(stream);
  for (const noteId of noteIds) {
    const file = await exportNote(userId, noteId, format);
    archive.append(file.body, { name: file.filename });
  }
  await archive.finalize();
  return { filename: "stash-notes.zip", mime: "application/zip", body: await done };
};
