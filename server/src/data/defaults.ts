import { emptyDoc, type JSONContent } from "../utils/content.js";

export const DEFAULT_FOLDERS = [
  { name: "Notes", icon: "sticky-note", color: "#6EC6F5" },
  { name: "Tasks", icon: "list-checks", color: "#111318" },
  { name: "Announcements", icon: "megaphone", color: "#F5B942" },
  { name: "Music", icon: "music", color: "#86E39B" },
  { name: "Questions", icon: "circle-help", color: "#C4B5FD" },
  { name: "Dashboard", icon: "layout-dashboard", color: "#6EC6F5" },
  { name: "Development", icon: "code", color: "#111318" },
  { name: "Swift", icon: "braces", color: "#FB7185" },
] as const;

const doc = (content: JSONContent[]): JSONContent => ({ type: "doc", content });
const heading = (level: number, text: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : [],
});
const tasks = (items: Array<{ text: string; checked?: boolean }>): JSONContent => ({
  type: "taskList",
  attrs: { columns: 2 },
  content: items.map((item) => ({
    type: "taskItem",
    attrs: { checked: Boolean(item.checked) },
    content: [paragraph(item.text)],
  })),
});

export const BUILT_IN_TEMPLATES: Array<{
  name: string;
  description: string;
  emoji: string;
  category: string;
  content: JSONContent;
}> = [
  {
    name: "Meeting notes",
    description: "Agenda, decisions, and follow-ups.",
    emoji: "🗣️",
    category: "work",
    content: doc([
      heading(1, "Meeting"),
      paragraph("Date, people, and the reason you are here."),
      heading(3, "Agenda"),
      tasks([{ text: "Topic one" }, { text: "Topic two" }]),
      heading(3, "Decisions"),
      paragraph(""),
      heading(3, "Follow-ups"),
      tasks([{ text: "Owner and next step" }]),
    ]),
  },
  {
    name: "Daily journal",
    description: "A short page for the day.",
    emoji: "🌤️",
    category: "personal",
    content: doc([
      heading(1, "Today"),
      paragraph("#morning"),
      heading(3, "Morning"),
      paragraph("What matters today."),
      heading(3, "Notes"),
      paragraph(""),
    ]),
  },
  {
    name: "To-do",
    description: "A two-column checklist.",
    emoji: "✅",
    category: "tasks",
    content: doc([
      heading(1, "To-do"),
      paragraph("#to-do's"),
      tasks([
        { text: "First task" },
        { text: "Second task" },
        { text: "Third task" },
        { text: "Fourth task" },
      ]),
    ]),
  },
  {
    name: "Grocery list",
    description: "Shopping with checks.",
    emoji: "🥕",
    category: "home",
    content: doc([
      heading(1, "Grocery list"),
      tasks([
        { text: "Apples" },
        { text: "Bread" },
        { text: "Olive oil" },
        { text: "Garlic" },
      ]),
    ]),
  },
  {
    name: "Project plan",
    description: "Goal, scope, and milestones.",
    emoji: "🗺️",
    category: "work",
    content: doc([
      heading(1, "Project"),
      paragraph("One sentence on the outcome."),
      heading(3, "Scope"),
      paragraph(""),
      heading(3, "Milestones"),
      tasks([{ text: "Kickoff" }, { text: "First review" }, { text: "Ship" }]),
    ]),
  },
  {
    name: "Recipe",
    description: "Ingredients and steps.",
    emoji: "🍲",
    category: "home",
    content: doc([
      heading(1, "Recipe"),
      paragraph("#recipes"),
      heading(3, "Ingredients"),
      tasks([{ text: "Ingredient" }]),
      heading(3, "Steps"),
      paragraph("1. "),
    ]),
  },
];

export const blankNoteContent = emptyDoc;
