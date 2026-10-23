import sanitizeHtml from "sanitize-html";

export interface JSONMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface JSONContent {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  marks?: JSONMark[];
  text?: string;
}

export const emptyDoc = (): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});

const walk = (node: JSONContent | undefined, visit: (node: JSONContent) => void) => {
  if (!node) return;
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
};

export const plainTextFromDoc = (doc: JSONContent | null | undefined): string => {
  const parts: string[] = [];
  walk(doc ?? undefined, (node) => {
    if (node.text) parts.push(node.text);
    if (node.type === "paragraph" || node.type === "heading" || node.type === "blockquote") {
      parts.push("\n");
    }
  });
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
};

export const extractHashtags = (text: string): string[] => {
  const found = text.match(/#([\p{L}\p{N}_'-]{1,40})/gu) ?? [];
  const tags = found.map((tag) => tag.slice(1).toLowerCase());
  return [...new Set(tags)];
};

export const wordCountOf = (text: string): number => {
  const words = text.trim().match(/\S+/g);
  return words?.length ?? 0;
};

export const readingMinutes = (text: string): number => {
  const words = wordCountOf(text);
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / 200));
};

export const docFlags = (doc: JSONContent | null | undefined) => {
  let hasChecklist = false;
  let hasImage = false;
  let hasAudio = false;
  walk(doc ?? undefined, (node) => {
    if (node.type === "taskList" || node.type === "taskItem") hasChecklist = true;
    if (node.type === "image") hasImage = true;
    if (node.type === "audio" || node.type === "voice") hasAudio = true;
  });
  return { hasChecklist, hasImage, hasAudio };
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const renderInline = (nodes: JSONContent[] | undefined): string => {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "<br />";
      const text = escapeHtml(node.text ?? "");
      if (!text) return renderInline(node.content);
      let html = text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") html = `<strong>${html}</strong>`;
        if (mark.type === "italic") html = `<em>${html}</em>`;
        if (mark.type === "underline") html = `<u>${html}</u>`;
        if (mark.type === "strike") html = `<s>${html}</s>`;
        if (mark.type === "code") html = `<code>${html}</code>`;
        if (mark.type === "link" && typeof mark.attrs?.href === "string") {
          const href = escapeHtml(mark.attrs.href);
          html = `<a href="${href}" rel="noopener noreferrer">${html}</a>`;
        }
      }
      return html;
    })
    .join("");
};

const renderBlocks = (nodes: JSONContent[] | undefined): string => {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      const inner = renderInline(node.content);
      switch (node.type) {
        case "heading": {
          const level = node.attrs?.level === 2 || node.attrs?.level === 3 ? node.attrs.level : 1;
          return `<h${level}>${inner}</h${level}>`;
        }
        case "paragraph":
          return `<p>${inner}</p>`;
        case "blockquote":
          return `<blockquote>${renderBlocks(node.content)}</blockquote>`;
        case "bulletList":
          return `<ul>${renderBlocks(node.content)}</ul>`;
        case "orderedList":
          return `<ol>${renderBlocks(node.content)}</ol>`;
        case "listItem":
          return `<li>${renderBlocks(node.content)}</li>`;
        case "taskList":
          return `<ul data-type="taskList">${renderBlocks(node.content)}</ul>`;
        case "taskItem": {
          const checked = node.attrs?.checked === true ? "checked" : "";
          return `<li data-checked="${node.attrs?.checked === true}"><input type="checkbox" disabled ${checked} /> ${renderBlocks(node.content)}</li>`;
        }
        case "codeBlock":
          return `<pre><code>${escapeHtml(plainTextFromDoc(node))}</code></pre>`;
        case "horizontalRule":
          return "<hr />";
        case "image": {
          const src = typeof node.attrs?.src === "string" ? escapeHtml(node.attrs.src) : "";
          const alt = typeof node.attrs?.alt === "string" ? escapeHtml(node.attrs.alt) : "";
          return src ? `<img src="${src}" alt="${alt}" />` : "";
        }
        case "audio":
        case "voice": {
          const src = typeof node.attrs?.src === "string" ? escapeHtml(node.attrs.src) : "";
          return src ? `<audio controls src="${src}"></audio>` : "";
        }
        default:
          return renderBlocks(node.content);
      }
    })
    .join("");
};

export const docToHtml = (doc: JSONContent | null | undefined): string =>
  sanitizeHtml(renderBlocks(doc?.content), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "audio",
      "h1",
      "h2",
      "span",
      "u",
      "s",
    ]),
    allowedAttributes: {
      a: ["href", "rel"],
      img: ["src", "alt"],
      audio: ["controls", "src"],
      li: ["data-checked"],
      ul: ["data-type"],
      input: ["type", "disabled", "checked"],
    },
  });

export const docToMarkdown = (doc: JSONContent | null | undefined): string => {
  const lines: string[] = [];
  const render = (nodes: JSONContent[] | undefined, indent = "") => {
    for (const node of nodes ?? []) {
      const text = (node.content ?? [])
        .map((child) => child.text ?? "")
        .join("");
      if (node.type === "heading") {
        const level = Number(node.attrs?.level ?? 1);
        lines.push(`${"#".repeat(Math.min(3, Math.max(1, level)))} ${text}`);
      } else if (node.type === "paragraph") {
        lines.push(`${indent}${text}`);
      } else if (node.type === "blockquote") {
        lines.push(`> ${text || plainTextFromDoc(node)}`);
      } else if (node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList") {
        (node.content ?? []).forEach((item, index) => {
          const marker =
            node.type === "orderedList" ? `${index + 1}. ` : node.type === "taskList" ? `- [${item.attrs?.checked ? "x" : " "}] ` : "- ";
          lines.push(`${indent}${marker}${plainTextFromDoc(item)}`);
        });
      } else if (node.type === "codeBlock") {
        lines.push("```");
        lines.push(plainTextFromDoc(node));
        lines.push("```");
      } else if (node.type === "horizontalRule") {
        lines.push("---");
      } else if (node.type === "image") {
        lines.push(`![${String(node.attrs?.alt ?? "image")}](${String(node.attrs?.src ?? "")})`);
      } else {
        render(node.content, indent);
      }
    }
  };
  render(doc?.content);
  return lines.join("\n").trim();
};

const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : [],
});

export const markdownToDoc = (markdown: string): JSONContent => {
  const content: JSONContent[] = [];
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      content.push({
        type: "codeBlock",
        content: [{ type: "text", text: code.join("\n") }],
      });
      index += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading?.[1] && heading[2] !== undefined) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: [{ type: "text", text: heading[2] }],
      });
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      content.push({ type: "blockquote", content: [paragraph(line.slice(2))] });
      index += 1;
      continue;
    }
    if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const items: JSONContent[] = [];
      while (index < lines.length && /^[-*]\s+\[[ xX]\]\s+/.test(lines[index] ?? "")) {
        const current = lines[index] ?? "";
        const checked = /^[-*]\s+\[[xX]\]/.test(current);
        const itemText = current.replace(/^[-*]\s+\[[ xX]\]\s+/, "");
        items.push({
          type: "taskItem",
          attrs: { checked },
          content: [paragraph(itemText)],
        });
        index += 1;
      }
      content.push({ type: "taskList", attrs: { columns: 2 }, content: items });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: JSONContent[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index] ?? "")) {
        items.push({ type: "listItem", content: [paragraph((lines[index] ?? "").replace(/^[-*]\s+/, ""))] });
        index += 1;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }
    if (line.trim() === "---") {
      content.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }
    content.push(paragraph(line));
    index += 1;
  }
  return { type: "doc", content: content.length > 0 ? content : [paragraph("")] };
};

export const textToDoc = (text: string): JSONContent =>
  markdownToDoc(text.split("\n").map((line) => line).join("\n"));
