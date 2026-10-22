export const messages = {
  brand: "Stash",
  tagline: "A quiet place for notes, lists, and the ideas you do not want to lose.",
  search: "Search notes",
  newPage: "New Page",
  notes: "Notes",
  templates: "Templates",
  import: "Import",
  trash: "Trash",
  workspace: "Workspace",
  updates: "Updates",
  share: "Share",
  saved: "Saved",
  saving: "Saving",
  offline: "Offline. Changes will sync when you reconnect.",
  emptyNotes: "This space is empty. Start a page.",
  emptyTrash: "Trash is empty.",
  login: "Log in",
  signup: "Get started",
  pricing: "Pricing",
} as const;

export type MessageKey = keyof typeof messages;

export const t = (key: MessageKey) => messages[key];
