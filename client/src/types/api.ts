export interface ApiErrorBody {
  message: string;
  details: unknown;
}

export interface PageMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface Envelope<T> {
  data: T;
  error: ApiErrorBody | null;
  meta: PageMeta | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  plan: "free" | "pro" | "team";
  trialEndsAt: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Member {
  userId: string;
  role: "owner" | "admin" | "member";
  email: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  ownerId: string;
  members: Member[];
  createdAt: string | null;
}

export interface Folder {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  icon: string;
  color: string;
  position: number;
  count?: number;
}

export interface NoteCover {
  kind: "none" | "upload" | "gallery";
  url: string | null;
  position: number;
}

export interface Collaborator {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  workspaceId: string;
  folderId: string | null;
  ownerId: string;
  title: string;
  emoji: string;
  content: Record<string, unknown> | null;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;
  colorLabel: string | null;
  cover: NoteCover;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  isLocked: boolean;
  locked: boolean;
  wordCount: number;
  readingMinutes: number;
  hasChecklist: boolean;
  hasImage: boolean;
  hasAudio: boolean;
  version: number;
  preview: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  collaborators: Collaborator[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  isBuiltIn: boolean;
  content: Record<string, unknown>;
}

export interface Reminder {
  id: string;
  noteId: string;
  workspaceId: string;
  startDate: string;
  endDate: string;
  times: string[];
  repeat: "none" | "daily" | "weekly" | "monthly";
  status: "pending" | "done" | "snoozed";
  snoozeUntil: string | null;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  noteId: string | null;
  kind: string;
  readAt: string | null;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  actorName: string;
  action: string;
  noteId: string | null;
  noteTitle: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  body: string;
  quote: string;
  authorId: string;
  authorName: string;
  resolved: boolean;
  createdAt: string;
}

export interface Share {
  id: string;
  type: string;
  role: string;
  email: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  url?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  count: number;
}
