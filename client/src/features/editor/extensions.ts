import { Node, mergeAttributes } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";

export const Voice = Node.create({
  name: "voice",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      peaks: { default: "" },
      duration: { default: 0 },
    };
  },
  parseHTML: () => [{ tag: "audio[data-voice]" }],
  renderHTML: ({ HTMLAttributes }) => ["audio", mergeAttributes(HTMLAttributes, { controls: "true", "data-voice": "true" })],
});

export const ColumnsTaskList = TaskList.extend({
  addAttributes() {
    return {
      columns: {
        default: 2,
        parseHTML: (element) => Number(element.getAttribute("data-columns") ?? 2),
        renderHTML: (attributes) => ({ "data-columns": attributes.columns }),
      },
    };
  },
});

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false },
  }),
  Highlight,
  TextStyle,
  Color,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Image,
  ColumnsTaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({ placeholder: "Write, or type / for blocks" }),
  CharacterCount,
  Voice,
];

export const slashCommands = [
  { id: "text", label: "Text", run: "paragraph" },
  { id: "h1", label: "Heading 1", run: "h1" },
  { id: "h2", label: "Heading 2", run: "h2" },
  { id: "h3", label: "Heading 3", run: "h3" },
  { id: "todo", label: "To-do list", run: "todo" },
  { id: "bullet", label: "Bulleted list", run: "bullet" },
  { id: "quote", label: "Quote", run: "quote" },
  { id: "code", label: "Code", run: "code" },
  { id: "divider", label: "Divider", run: "divider" },
  { id: "table", label: "Table", run: "table" },
] as const;
