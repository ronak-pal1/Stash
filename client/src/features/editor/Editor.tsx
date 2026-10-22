import { BubbleMenu } from "@tiptap/react/menus";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import { AlignLeft, AlignRight, Bold, Code, ImageIcon, Italic, List, ListTodo, Strikethrough, Underline as UnderlineIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { slashCommands, editorExtensions } from "./extensions";
import { IconButton } from "../../components/ui";

const runSlash = (editor: TiptapEditor, id: string) => {
  const { from } = editor.state.selection;
  const text = editor.state.doc.textBetween(Math.max(0, from - 30), from, "\n", "\n");
  const match = /\/[\w]*$/.exec(text);
  if (match) editor.commands.deleteRange({ from: from - match[0].length, to: from });
  if (id === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run();
  if (id === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
  if (id === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
  if (id === "todo") editor.chain().focus().toggleTaskList().run();
  if (id === "bullet") editor.chain().focus().toggleBulletList().run();
  if (id === "quote") editor.chain().focus().toggleBlockquote().run();
  if (id === "code") editor.chain().focus().toggleCodeBlock().run();
  if (id === "divider") editor.chain().focus().setHorizontalRule().run();
  if (id === "table") editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  if (id === "text") editor.chain().focus().setParagraph().run();
};

export function NoteBody({
  content,
  editable,
  onChange,
  onUploadImage,
}: {
  content: Record<string, unknown> | null;
  editable: boolean;
  onChange: (json: Record<string, unknown>) => void;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [slash, setSlash] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [blockLabel, setBlockLabel] = useState("");
  const editor = useEditor({
    extensions: editorExtensions,
    content: content ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    editorProps: {
      attributes: { class: "prose-note min-h-[40vh] outline-none", style: "font-size: var(--editor-size)" },
      handleDrop: (view, event) => {
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return false;
        event.preventDefault();
        void onUploadImage(file).then((src) => {
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const image = view.state.schema.nodes.image;
          if (!image || !coords) return;
          view.dispatch(view.state.tr.insert(coords.pos, image.create({ src })));
        });
        return true;
      },
      handlePaste: (_view, event) => {
        const file = event.clipboardData?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return false;
        event.preventDefault();
        void onUploadImage(file).then((src) => editor?.chain().focus().setImage({ src }).run());
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.getJSON() as Record<string, unknown>);
      const { from } = current.state.selection;
      const before = current.state.doc.textBetween(Math.max(0, from - 24), from, "\n", "\n");
      const match = /\/([\w]*)$/.exec(before);
      setSlash(match ? (match[1] ?? "") : null);
      const parent = current.state.selection.$from.parent;
      const label = parent.type.name === "heading" ? `H${parent.attrs.level ?? 1}` : parent.type.name === "paragraph" ? "" : parent.type.name;
      setBlockLabel(String(label).toUpperCase());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(content ?? {});
    const current = JSON.stringify(editor.getJSON());
    if (incoming !== current && !editor.isFocused) editor.commands.setContent(content ?? { type: "doc", content: [{ type: "paragraph" }] }, { emitUpdate: false });
  }, [content, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  const filtered = useMemo(() => slashCommands.filter((command) => command.label.toLowerCase().includes((slash ?? "").toLowerCase()) || command.id.includes(slash ?? "")), [slash]);

  const findNext = () => {
    if (!editor || !query) return;
    let found = false;
    editor.state.doc.descendants((node, pos) => {
      if (found || !node.isText || !node.text) return;
      const index = node.text.toLowerCase().indexOf(query.toLowerCase());
      if (index >= 0) {
        editor.commands.setTextSelection({ from: pos + index, to: pos + index + query.length });
        found = true;
      }
    });
  };

  if (!editor) return null;

  return (
    <div className="relative">
      {blockLabel ? <div className="gutter-label top-2 hidden lg:block">{blockLabel}</div> : null}
      {slash !== null ? (
        <div className="glass absolute z-20 mt-2 w-56 rounded-2xl p-1 text-sm" role="listbox" aria-label="Insert block">
          {filtered.map((command) => (
            <button key={command.id} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-black/5" onClick={() => { runSlash(editor, command.id); setSlash(null); }}>
              {command.label}
            </button>
          ))}
        </div>
      ) : null}
      <BubbleMenu editor={editor}>
        <div className="glass-dark flex items-center gap-1 rounded-full px-2 py-1 text-xs">
          <FormatButton editor={editor} label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></FormatButton>
          <FormatButton editor={editor} label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></FormatButton>
          <FormatButton editor={editor} label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></FormatButton>
          <button className="px-2" onClick={() => { const text = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " "); void navigator.clipboard.writeText(text); }}>Copy</button>
          <button className="px-2" onClick={() => { const text = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " "); void navigator.clipboard.writeText(text); editor.chain().focus().deleteSelection().run(); }}>Cut</button>
          <button className="px-2" onClick={() => { const text = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " "); void navigator.share?.({ text }).catch(() => navigator.clipboard.writeText(text)); }}>Share</button>
        </div>
      </BubbleMenu>
      <EditorContent editor={editor} />
      {findOpen ? (
        <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); findNext(); }}>
          <input aria-label="Find in note" value={query} onChange={(event) => setQuery(event.target.value)} className="rounded-full border border-[var(--line)] px-3 py-1 text-sm" placeholder="Find" />
          <button className="text-sm" type="submit">Next</button>
        </form>
      ) : null}
      <div className="pointer-events-none absolute -right-2 bottom-4 hidden flex-col gap-2 lg:flex">
        <IconButton label="Insert block" className="pointer-events-auto glass h-12 w-12" onClick={() => editor.chain().focus().insertContent("/").run()}><span className="text-lg">+</span></IconButton>
        <IconButton label="Formatting" className="pointer-events-auto glass h-12 w-12" onClick={() => setFindOpen((value) => !value)}><span className="text-sm font-semibold">Aa</span></IconButton>
      </div>
      <div className="sticky bottom-[var(--keyboard-inset)] z-20 mt-4 flex gap-1 overflow-auto rounded-full bg-[var(--surface)] px-2 py-2 lg:hidden" aria-label="Formatting">
        <Mini editor={editor} label="Text style" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><span className="text-xs font-bold">T</span></Mini>
        <Mini editor={editor} label="List" onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></Mini>
        <Mini editor={editor} label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></Mini>
        <Mini editor={editor} label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></Mini>
        <Mini editor={editor} label="Image" onClick={() => document.getElementById("inline-image")?.click()}><ImageIcon size={16} /></Mini>
        <Mini editor={editor} label="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={16} /></Mini>
        <Mini editor={editor} label="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={16} /></Mini>
        <Mini editor={editor} label="Task" onClick={() => editor.chain().focus().toggleTaskList().run()}><ListTodo size={16} /></Mini>
        <Mini editor={editor} label="Strike" onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></Mini>
        <Mini editor={editor} label="Code" onClick={() => editor.chain().focus().toggleCode().run()}><Code size={16} /></Mini>
      </div>
      <input id="inline-image" type="file" accept="image/*" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        void onUploadImage(file).then((src) => editor.chain().focus().setImage({ src }).run());
      }} />
    </div>
  );
}

function FormatButton({ label, active, onClick, children }: { editor: TiptapEditor; label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} aria-pressed={active} className={active ? "rounded-full bg-white/20 p-1" : "p-1"} onClick={onClick}>{children}</button>;
}

function Mini({ label, onClick, children }: { editor: TiptapEditor; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" onClick={onClick}>{children}</button>;
}
