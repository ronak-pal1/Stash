import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format, parseISO } from "date-fns";
import { Bell, ChevronDown, ChevronUp, Download, MoreHorizontal, Pin, Plus, Search, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { AppIcon } from "../../components/icons";
import { GlassSurface } from "../../components/GlassSurface";
import { AvatarStack, IconButton, MenuItem, MenuPanel, Modal, Skeleton } from "../../components/ui";
import { NoteBody } from "../editor/Editor";
import { ApiError, api, cacheNote, flushOutbox } from "../../lib/api";
import { relativeTime } from "../../lib/format";
import { t } from "../../lib/messages";
import { useAuth } from "../../store/auth";
import { useUi } from "../../store/ui";
import type { ActivityItem, Folder, Note, Reminder, Share, Template, Workspace } from "../../types/api";
import { useMedia } from "./useMedia";

const EMOJIS = ["📝", "💡", "🌶️", "✅", "🥕", "📚", "🌤️", "🗺️", "🍲", "🎧", "📌", "✨"];
const GALLERY = [
  { url: "/covers/desk.svg", label: "Desk" },
  { url: "/covers/plants.svg", label: "Plants" },
  { url: "/covers/ideas.svg", label: "Ideas" },
];

export function WorkspaceApp() {
  const mobile = useMedia("(max-width: 767px)");
  const tablet = useMedia("(max-width: 1023px)");
  const user = useAuth((state) => state.user);
  const token = useAuth((state) => state.accessToken);
  const ui = useUi();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const section = params.get("section") ?? "notes";
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<"updated" | "created" | "title">("updated");
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; note: Note } | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [presence, setPresence] = useState<Array<{ userId: string; name: string }>>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => (await api<Workspace[]>("/api/v1/workspaces")).data,
  });

  useEffect(() => {
    const first = workspaces.data?.[0];
    if (!ui.workspaceId && first) ui.setWorkspaceId(first.id);
  }, [workspaces.data, ui]);

  const workspaceId = ui.workspaceId;
  const folders = useQuery({
    queryKey: ["folders", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => (await api<{ folders: Folder[]; total: number }>(`/api/v1/folders?workspaceId=${workspaceId}`)).data,
  });
  const notesQuery = useInfiniteQuery({
    queryKey: ["notes", workspaceId, ui.folderId, debounced, sort, section],
    enabled: Boolean(workspaceId),
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const search = new URLSearchParams({ workspaceId: workspaceId ?? "", sort, limit: "20" });
      if (ui.folderId && section === "notes") search.set("folderId", ui.folderId);
      if (debounced) search.set("q", debounced);
      if (section === "trash") search.set("trashed", "true");
      if (pageParam) search.set("cursor", pageParam);
      return api<{ notes: Note[] }>(`/api/v1/notes?${search}`);
    },
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });
  const notes = notesQuery.data?.pages.flatMap((page) => page.data.notes) ?? [];
  const noteId = ui.noteId ?? notes[0]?.id ?? null;
  const noteQuery = useQuery({
    queryKey: ["note", noteId],
    enabled: Boolean(noteId) && section === "notes",
    queryFn: async () => {
      const note = (await api<Note>(`/api/v1/notes/${noteId}`)).data;
      await cacheNote(note);
      return note;
    },
  });

  useEffect(() => {
    if (!token || !noteId) return;
    const socket: Socket = io({ auth: { token } });
    socket.emit("note:join", noteId);
    socket.on("presence", (people: Array<{ userId: string; name: string }>) => setPresence(people));
    socket.on("note:remote", () => setToast("This note was edited in another session"));
    return () => {
      socket.emit("note:leave", noteId);
      socket.disconnect();
    };
  }, [token, noteId]);

  const createNote = useCallback(async (folderId = ui.folderId) => {
    if (!workspaceId) return;
    const created = await api<Note>("/api/v1/notes", {
      method: "POST",
      body: JSON.stringify({ workspaceId, folderId, title: "" }),
    });
    ui.setNoteId(created.data.id);
    navigate("/app");
    await queryClient.invalidateQueries({ queryKey: ["notes"] });
  }, [navigate, queryClient, ui, workspaceId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        ui.setCommandOpen(true);
      }
      if (meta && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void createNote();
      }
      if (meta && event.key === "\\") {
        event.preventDefault();
        ui.toggleSidebar();
      }
      if (event.key === "?" && !event.metaKey && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        ui.setShortcutHelp(true);
      }
    };
    const onOnline = () => void flushOutbox();
    window.addEventListener("keydown", onKey);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("online", onOnline);
    };
  }, [createNote, ui]);

  const patchNote = async (id: string, body: Record<string, unknown>) => {
    try {
      const updated = await api<Note>(`/api/v1/notes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      queryClient.setQueryData(["note", id], updated.data);
      return updated.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setToast("This note changed somewhere else. Reload to see it.");
      else setToast(t("offline"));
      throw error;
    }
  };

  const workspace = workspaces.data?.find((item) => item.id === workspaceId) ?? workspaces.data?.[0];

  const shell = (
    <div className="flex min-h-0 flex-1">
      {(!tablet || drawer) && !ui.sidebarCollapsed ? (
        <Sidebar
          workspace={workspace}
          workspaces={workspaces.data ?? []}
          folders={folders.data?.folders ?? []}
          total={folders.data?.total ?? 0}
          section={section}
          onSelectFolder={(id) => { ui.setFolderId(id); navigate("/app"); setDrawer(false); }}
          onCreate={() => void createNote()}
          onReorder={async (ids) => {
            if (!workspaceId) return;
            await api("/api/v1/folders/reorder", { method: "POST", body: JSON.stringify({ workspaceId, ids }) });
            await queryClient.invalidateQueries({ queryKey: ["folders"] });
          }}
        />
      ) : null}
      <section className="flex min-w-0 flex-1">
        {section === "notes" || section === "trash" || section === "search" ? (
          <>
            {!mobile || !noteId || section === "search" ? (
              <NoteColumn
                notes={notes}
                selectedId={noteId}
                loading={notesQuery.isLoading}
                title={section === "trash" ? "Trash" : "Notes"}
                sort={sort}
                onSort={setSort}
                query={query}
                onQuery={setQuery}
                onSelect={(id) => { ui.setNoteId(id); if (mobile) navigate("/app?section=editor"); }}
                onMenu={(event, note) => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, note }); }}
                onMore={() => void notesQuery.fetchNextPage()}
                hasMore={Boolean(notesQuery.hasNextPage)}
                showSearch={mobile}
              />
            ) : null}
            {section !== "search" && (!mobile || params.get("section") === "editor") && noteQuery.data ? (
              <EditorPane
                note={noteQuery.data}
                presence={presence}
                onPatch={(body) => patchNote(noteQuery.data.id, body)}
                onShare={() => setShareOpen(true)}
                onUpdates={() => setUpdatesOpen(true)}
                onReminder={() => setReminderOpen(true)}
                onBack={() => navigate("/app")}
                folders={folders.data?.folders ?? []}
              />
            ) : null}
          </>
        ) : null}
        {section === "templates" && workspaceId ? <Templates workspaceId={workspaceId} onCreated={(id) => { ui.setNoteId(id); navigate("/app"); }} /> : null}
        {section === "import" && workspaceId ? <ImportPanel workspaceId={workspaceId} /> : null}
        {section === "calendar" && workspaceId ? <CalendarPanel workspaceId={workspaceId} notes={notes} onOpen={(id) => { ui.setNoteId(id); navigate("/app?section=editor"); }} /> : null}
        {section === "settings" ? <Settings onToast={setToast} /> : null}
      </section>
    </div>
  );

  return (
    <div className="app-bg min-h-svh p-3 md:p-5">
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />
      <div className="relative z-10 mx-auto flex h-[calc(100svh-1.5rem)] max-w-[1440px] flex-col overflow-hidden rounded-[36px] bg-[var(--surface)] shadow-[var(--shadow)] md:h-[calc(100svh-2.5rem)]">
        {!mobile ? (
          <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
            <button className="flex items-center gap-2 font-semibold" onClick={() => setDrawer((value) => !value)}>
              <img src="/favicon.svg" alt="" className="h-7 w-7" />
              {workspace?.name ?? "Stash"}
              <ChevronDown size={16} />
            </button>
            <label className="mx-auto flex w-full max-w-md items-center gap-2 rounded-full bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--ink-soft)]">
              <Search size={16} />
              <input aria-label={t("search")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} className="w-full bg-transparent outline-none" />
            </label>
            <IconButton label="Notifications" onClick={() => navigate("/app?section=calendar")}><Bell size={18} /></IconButton>
            <IconButton label="Export" onClick={() => noteId && void exportNote(noteId)}><Download size={18} /></IconButton>
            <button className="text-sm" onClick={() => setUpdatesOpen(true)}>{t("updates")}</button>
            <button className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-sm text-white" onClick={() => setShareOpen(true)}>{t("share")}</button>
            <AvatarStack people={presence.length ? presence.map((person) => ({ id: person.userId, name: person.name })) : [{ id: user?.id ?? "me", name: user?.name ?? "You" }]} />
            <IconButton label="Account" onClick={() => navigate("/app?section=settings")}><MoreHorizontal size={18} /></IconButton>
          </header>
        ) : null}
        {shell}
        {mobile ? <MobileTabs onCreate={() => void createNote()} /> : null}
      </div>
      {menu ? (
        <div className="fixed z-50" style={{ left: menu.x, top: menu.y }} role="menu">
          <MenuPanel>
            <MenuItem onClick={() => { void patchNote(menu.note.id, { isPinned: !menu.note.isPinned }); setMenu(null); }}>Pin</MenuItem>
            <MenuItem onClick={() => { void api(`/api/v1/notes/${menu.note.id}/duplicate`, { method: "POST" }).then(() => queryClient.invalidateQueries({ queryKey: ["notes"] })); setMenu(null); }}>Duplicate</MenuItem>
            <MenuItem onClick={() => { ui.setNoteId(menu.note.id); setShareOpen(true); setMenu(null); }}>Share</MenuItem>
            <MenuItem onClick={() => { void exportNote(menu.note.id); setMenu(null); }}>Export</MenuItem>
            <MenuItem onClick={() => { void api(`/api/v1/notes/${menu.note.id}`, { method: "DELETE" }).then(() => queryClient.invalidateQueries({ queryKey: ["notes"] })); setMenu(null); }}>Delete</MenuItem>
          </MenuPanel>
        </div>
      ) : null}
      {toast ? <button className="glass-dark fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm" onClick={() => setToast(null)}>{toast}</button> : null}
      <Modal open={shareOpen} title="Share" onClose={() => setShareOpen(false)}>
        {noteId ? <ShareForm noteId={noteId} /> : <p>Open a note first.</p>}
      </Modal>
      <Modal open={updatesOpen} title="Updates" onClose={() => setUpdatesOpen(false)}>
        {workspaceId && noteId ? <Updates workspaceId={workspaceId} noteId={noteId} onRestore={() => queryClient.invalidateQueries({ queryKey: ["note", noteId] })} /> : null}
      </Modal>
      <Modal open={reminderOpen} title="Add reminder" onClose={() => setReminderOpen(false)}>
        {noteId ? <ReminderForm noteId={noteId} onDone={() => setReminderOpen(false)} /> : null}
      </Modal>
      <Modal open={ui.commandOpen} title="Jump to" onClose={() => ui.setCommandOpen(false)}>
        <CommandList notes={notes} onPick={(id) => { ui.setNoteId(id); ui.setCommandOpen(false); navigate("/app"); }} />
      </Modal>
      <Modal open={ui.shortcutHelp} title="Shortcuts" onClose={() => ui.setShortcutHelp(false)}>
        <ul className="grid gap-1 text-sm text-[var(--ink-soft)]">
          <li>Cmd/Ctrl N new page</li>
          <li>Cmd/Ctrl K command palette</li>
          <li>Cmd/Ctrl \ sidebar</li>
          <li>? this help</li>
        </ul>
      </Modal>
    </div>
  );
}

async function exportNote(noteId: string) {
  const token = useAuth.getState().accessToken;
  const response = await fetch(`/api/v1/notes/${noteId}/export?format=md`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "note.md";
  link.click();
  URL.revokeObjectURL(url);
}

function Sidebar({
  workspace, workspaces, folders, total, section, onSelectFolder, onCreate, onReorder,
}: {
  workspace?: Workspace;
  workspaces: Workspace[];
  folders: Folder[];
  total: number;
  section: string;
  onSelectFolder: (id: string | null) => void;
  onCreate: () => void;
  onReorder: (ids: string[]) => Promise<void>;
}) {
  const ui = useUi();
  const [dragId, setDragId] = useState<string | null>(null);
  const roots = folders.filter((folder) => !folder.parentId);
  return (
    <aside className="glass-strong flex w-[260px] shrink-0 flex-col border-r border-white/40 p-3">
      <details className="mb-3">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-2 py-2 text-sm font-medium">
          <span className="flex items-center gap-2"><img src="/favicon.svg" alt="" className="h-6 w-6" />{workspace?.name}</span>
          <span className="grid"><ChevronUp size={12} /><ChevronDown size={12} /></span>
        </summary>
        <div className="mt-1 grid">
          {workspaces.map((item) => (
            <button key={item.id} className="rounded-xl px-2 py-1.5 text-left text-sm" onClick={() => ui.setWorkspaceId(item.id)}>{item.name}</button>
          ))}
          <button className="rounded-xl px-2 py-1.5 text-left text-sm" onClick={() => {
            const name = window.prompt("Workspace name");
            if (!name) return;
            void api<Workspace>("/api/v1/workspaces", { method: "POST", body: JSON.stringify({ name }) }).then((result) => ui.setWorkspaceId(result.data.id));
          }}>New workspace</button>
        </div>
      </details>
      <nav className="grid gap-1 text-sm" aria-label="Library">
        <Link className={section === "templates" ? "rounded-xl bg-white/70 px-2 py-2" : "px-2 py-2"} to="/app?section=templates">Templates</Link>
        <Link className="px-2 py-2" to="/app?section=import">Import</Link>
        <Link className={section === "trash" ? "rounded-xl bg-white/70 px-2 py-2" : "px-2 py-2"} to="/app?section=trash">Trash</Link>
      </nav>
      <p className="mt-5 px-2 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)]">WORKSPACE</p>
      <div className="mt-1 grid gap-0.5 overflow-auto">
        <button className={!ui.folderId && section === "notes" ? "rounded-xl bg-white px-2 py-2 text-left text-sm font-medium" : "px-2 py-2 text-left text-sm"} onClick={() => onSelectFolder(null)}>
          <span className="flex items-center gap-2"><AppIcon name="sticky-note" className="h-4 w-4" /> Notes <span className="ml-auto text-[var(--muted)]">{total}</span></span>
        </button>
        {roots.map((folder) => (
          <div key={folder.id} draggable onDragStart={() => setDragId(folder.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => {
            if (!dragId || dragId === folder.id) return;
            const ids = roots.map((item) => item.id);
            const from = ids.indexOf(dragId);
            const to = ids.indexOf(folder.id);
            ids.splice(to, 0, ids.splice(from, 1)[0] ?? dragId);
            void onReorder(ids);
          }} className={ui.folderId === folder.id ? "rounded-xl bg-white" : ""}>
            <button className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm" onClick={() => onSelectFolder(folder.id)}>
              <AppIcon name={folder.icon} className="h-4 w-4" /> {folder.name}
              <span className="ml-auto text-[var(--muted)]">{folder.count ?? 0}</span>
            </button>
          </div>
        ))}
      </div>
      <button className="mt-auto flex items-center gap-2 px-2 py-3 text-sm font-medium" onClick={onCreate}>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--ink)] text-white"><Plus size={16} /></span>
        {t("newPage")}
      </button>
    </aside>
  );
}

function NoteColumn({
  notes, selectedId, loading, title, sort, onSort, query, onQuery, onSelect, onMenu, onMore, hasMore, showSearch,
}: {
  notes: Note[];
  selectedId: string | null;
  loading: boolean;
  title: string;
  sort: "updated" | "created" | "title";
  onSort: (sort: "updated" | "created" | "title") => void;
  query: string;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onMenu: (event: React.MouseEvent, note: Note) => void;
  onMore: () => void;
  hasMore: boolean;
  showSearch: boolean;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns functions the React compiler cannot memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({ count: notes.length, getScrollElement: () => parentRef.current, estimateSize: () => 168, overscan: 4 });
  return (
    <div className="flex w-full max-w-[420px] flex-col border-r border-[var(--line)]">
      <div className="flex items-center justify-between px-5 pt-5">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <label className="text-xs text-[var(--muted)]">
          Sort
          <select aria-label="Sort notes" className="ml-1 bg-transparent" value={sort} onChange={(event) => onSort(event.target.value as "updated" | "created" | "title")}>
            <option value="updated">Updated</option>
            <option value="created">Created</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>
      {showSearch ? (
        <label className="mx-5 mt-3 flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-4 py-2 text-sm">
          <Search size={16} />
          <input aria-label={t("search")} value={query} onChange={(event) => onQuery(event.target.value)} placeholder={t("search")} className="w-full bg-transparent outline-none" />
        </label>
      ) : null}
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {loading ? <Skeleton className="h-36" /> : null}
        {!loading && notes.length === 0 ? <p className="px-2 text-sm text-[var(--ink-soft)]">{title === "Trash" ? t("emptyTrash") : t("emptyNotes")}</p> : null}
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((item) => {
            const note = notes[item.index];
            if (!note) return null;
            const selected = note.id === selectedId;
            return (
              <article key={note.id} style={{ position: "absolute", top: 0, transform: `translateY(${item.start}px)`, width: "100%" }} className="pb-3">
                <button className="block w-full text-left" onClick={() => onSelect(note.id)} onContextMenu={(event) => onMenu(event, note)}>
                  <div className={selected ? "glass-accent rounded-[24px] p-4" : "rounded-[24px] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"}>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-semibold">{note.emoji} {note.title || "Untitled"}</h2>
                      {note.isPinned ? <Pin size={14} /> : null}
                    </div>
                    {note.tags.length ? <p className="mt-1 text-xs opacity-80">{note.tags.map((tag) => `#${tag}`).join(" ")}</p> : null}
                    <p className="mt-2 line-clamp-2 text-sm opacity-80">{highlightPreview(note.preview, query)}</p>
                    <div className="mt-3 flex items-end justify-between text-xs">
                      <span>{relativeTime(note.updatedAt)}</span>
                      <span className="flex items-center gap-2">
                        {note.locationLabel ? <span className={selected ? "" : "text-[var(--accent-hover)]"}>{note.locationLabel}</span> : null}
                        <AvatarStack people={note.collaborators} />
                      </span>
                    </div>
                  </div>
                </button>
              </article>
            );
          })}
        </div>
        {hasMore ? <button className="text-sm text-[var(--ink-soft)]" onClick={onMore}>Load more</button> : null}
      </div>
    </div>
  );
}

function highlightPreview(preview: string, query: string) {
  if (!query) return preview;
  const parts = preview.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return parts.map((part, index) => part.toLowerCase() === query.toLowerCase() ? <mark key={index} className="bg-transparent font-semibold underline">{part}</mark> : <span key={index}>{part}</span>);
}

function EditorPane({
  note, presence, onPatch, onShare, onUpdates, onReminder, onBack, folders,
}: {
  note: Note;
  presence: Array<{ userId: string; name: string }>;
  onPatch: (body: Record<string, unknown>) => Promise<Note>;
  onShare: () => void;
  onUpdates: () => void;
  onReminder: () => void;
  onBack: () => void;
  folders: Folder[];
}) {
  const [titleState, setTitleState] = useState({ id: note.id, title: note.title });
  if (titleState.id !== note.id || (titleState.title !== note.title && document.activeElement?.getAttribute("aria-label") !== "Title")) {
    setTitleState({ id: note.id, title: note.title });
  }
  const title = titleState.title;
  const setTitle = (value: string) => setTitleState({ id: note.id, title: value });
  const [status, setStatus] = useState<"saved" | "saving">("saved");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const version = useRef(note.version);
  useEffect(() => {
    version.current = note.version;
  }, [note.version]);
  const timer = useRef<number | null>(null);

  const schedule = (body: Record<string, unknown>) => {
    if (timer.current) window.clearTimeout(timer.current);
    setStatus("saving");
    timer.current = window.setTimeout(() => {
      void onPatch({ ...body, baseVersion: version.current }).then((updated) => {
        version.current = updated.version;
        setStatus("saved");
      }).catch(() => setStatus("saved"));
    }, 800);
  };

  const upload = async (file: File) => {
    const data = new FormData();
    data.set("file", file);
    const token = useAuth.getState().accessToken;
    const response = await fetch(`/api/v1/notes/${note.id}/attachments`, { method: "POST", body: data, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const body = await response.json() as { data: { url: string } };
    return body.data.url;
  };

  return (
    <div className="relative min-w-0 flex-1 overflow-auto px-5 py-4 md:px-10">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <button className="lg:hidden" onClick={onBack}>Back</button>
        <select aria-label="Folder" className="bg-transparent" value={note.folderId ?? ""} onChange={(event) => void onPatch({ folderId: event.target.value || null, baseVersion: version.current })}>
          <option value="">No folder</option>
          {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        <span className="ml-auto text-xs text-[var(--muted)]">{status === "saving" ? t("saving") : t("saved")} · {note.wordCount} words</span>
        <IconButton label="Reminder" onClick={onReminder}><span className="text-xs">⏱</span></IconButton>
        <IconButton label="Pin" onClick={() => void onPatch({ isPinned: !note.isPinned, baseVersion: version.current })}><Pin size={16} /></IconButton>
        <button className="hidden text-sm md:inline" onClick={onUpdates}>{t("updates")}</button>
        <button className="hidden md:inline" onClick={onShare}><Share2 size={16} /></button>
        <AvatarStack people={presence.map((person) => ({ id: person.userId, name: person.name }))} />
      </div>
      {note.cover.kind !== "none" && note.cover.url ? (
        <img src={note.cover.url} alt="" className="mb-4 h-48 w-full rounded-[24px] object-cover" style={{ objectPosition: `center ${note.cover.position}%` }} />
      ) : null}
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        {GALLERY.map((cover) => (
          <button key={cover.url} className="rounded-full bg-[var(--surface-2)] px-2 py-1" onClick={() => void onPatch({ cover: { kind: "gallery", url: cover.url, position: 50 }, baseVersion: version.current })}>{cover.label}</button>
        ))}
        <button className="rounded-full bg-[var(--surface-2)] px-2 py-1" onClick={() => void onPatch({ cover: { kind: "none", url: null, position: 50 }, baseVersion: version.current })}>Remove cover</button>
      </div>
      <div className="flex items-start gap-2">
        <button aria-label="Emoji" className="text-3xl" onClick={() => setEmojiOpen((value) => !value)}>{note.emoji || "☺"}</button>
        <input aria-label="Title" value={title} onChange={(event) => { setTitle(event.target.value); schedule({ title: event.target.value }); }} placeholder="Untitled" className="w-full bg-transparent text-4xl font-semibold tracking-tight outline-none" />
      </div>
      {emojiOpen ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {EMOJIS.map((emoji) => <button key={emoji} className="text-xl" onClick={() => { setEmojiOpen(false); void onPatch({ emoji, baseVersion: version.current }); }}>{emoji}</button>)}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {note.tags.map((tag) => <span key={tag} className="text-sm text-[var(--accent-hover)]">#{tag}</span>)}
      </div>
      {note.locked && !note.content ? <Unlock noteId={note.id} /> : (
        <NoteBody content={note.content} editable onChange={(json) => schedule({ content: json })} onUploadImage={upload} />
      )}
      <VoiceRecorder noteId={note.id} onSaved={(url) => schedule({ content: { type: "doc", content: [...((note.content?.content as unknown[]) ?? []), { type: "voice", attrs: { src: url } }] } })} />
    </div>
  );
}

function Unlock({ noteId }: { noteId: string }) {
  const [password, setPassword] = useState("");
  const client = useQueryClient();
  return (
    <form className="mt-6 grid max-w-sm gap-2" onSubmit={(event) => {
      event.preventDefault();
      void api<{ unlockToken: string; note: Note }>(`/api/v1/notes/${noteId}/unlock`, { method: "POST", body: JSON.stringify({ password }) }).then((result) => {
        client.setQueryData(["note", noteId], result.data.note);
      });
    }}>
      <p>This note is locked.</p>
      <input aria-label="Note password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-2xl border border-[var(--line)] px-3 py-2" />
      <button className="rounded-full bg-[var(--ink)] px-4 py-2 text-white" type="submit">Unlock</button>
    </form>
  );
}

function VoiceRecorder({ noteId, onSaved }: { noteId: string; onSaved: (url: string) => void }) {
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const media = new MediaRecorder(stream);
    chunks.current = [];
    media.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
      const data = new FormData();
      data.set("file", new File([blob], "voice.webm", { type: blob.type }));
      const token = useAuth.getState().accessToken;
      void fetch(`/api/v1/notes/${noteId}/audio`, { method: "POST", body: data, headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((response) => response.json())
        .then((body: { data: { url: string } }) => onSaved(body.data.url));
    };
    recorder.current = media;
    media.start();
    setRecording(true);
  };
  return (
    <div className="mt-4">
      <button className="rounded-full bg-[var(--mint)] px-4 py-2 text-sm font-semibold text-[var(--mint-deep)]" onClick={() => { if (recording) { recorder.current?.stop(); setRecording(false); } else void start(); }}>
        {recording ? "Stop voice note" : "Record voice note"}
      </button>
    </div>
  );
}

function ShareForm({ noteId }: { noteId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [link, setLink] = useState("");
  const shares = useQuery({ queryKey: ["shares", noteId], queryFn: async () => (await api<Share[]>(`/api/v1/notes/${noteId}/shares`)).data });
  return (
    <div className="grid gap-3 text-sm">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void api(`/api/v1/notes/${noteId}/shares`, { method: "POST", body: JSON.stringify({ email, role }) }); }}>
        <input aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} className="flex-1 rounded-full border border-[var(--line)] px-3 py-2" placeholder="name@email.com" />
        <select aria-label="Role" value={role} onChange={(event) => setRole(event.target.value as "viewer" | "editor")}><option value="viewer">Viewer</option><option value="editor">Editor</option></select>
        <button className="rounded-full bg-[var(--ink)] px-3 text-white" type="submit">Invite</button>
      </form>
      <button className="rounded-full bg-[var(--accent-soft)] px-3 py-2" onClick={() => void api<Share>(`/api/v1/notes/${noteId}/links`, { method: "POST", body: "{}" }).then((result) => setLink(result.data.url ?? ""))}>Create public link</button>
      {link ? <p className="break-all">{link}</p> : null}
      <ul>{shares.data?.map((share) => <li key={share.id}>{share.email ?? "Link"} · {share.role}</li>)}</ul>
    </div>
  );
}

function Updates({ workspaceId, noteId, onRestore }: { workspaceId: string; noteId: string; onRestore: () => void }) {
  const activity = useQuery({ queryKey: ["activity", workspaceId], queryFn: async () => (await api<ActivityItem[]>(`/api/v1/activity?workspaceId=${workspaceId}`)).data });
  const versions = useQuery({ queryKey: ["versions", noteId], queryFn: async () => (await api<Array<{ id: string; title: string; createdAt: string }>>(`/api/v1/notes/${noteId}/versions`)).data });
  return (
    <div className="grid gap-3 text-sm">
      <h3 className="font-semibold">Versions</h3>
      {versions.data?.map((version) => (
        <div key={version.id} className="flex items-center justify-between">
          <span>{version.title || "Untitled"} · {relativeTime(version.createdAt)}</span>
          <button onClick={() => void api(`/api/v1/notes/${noteId}/versions/${version.id}/restore`, { method: "POST" }).then(onRestore)}>Restore</button>
        </div>
      ))}
      <h3 className="font-semibold">Activity</h3>
      {activity.data?.map((item) => <p key={item.id}>{item.actorName} {item.action.replace("note.", "")} {item.noteTitle}</p>)}
    </div>
  );
}

function ReminderForm({ noteId, onDone }: { noteId: string; onDone: () => void }) {
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(start);
  const [time, setTime] = useState("10:30");
  const [second, setSecond] = useState("14:30");
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const days = useMemo(() => monthDays(start), [start]);
  return (
    <form className="grid gap-3" onSubmit={(event) => {
      event.preventDefault();
      void api("/api/v1/reminders", { method: "POST", body: JSON.stringify({ noteId, startDate: start, endDate: end, times: [time, second].filter(Boolean), repeat }) }).then(onDone);
    }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setStart(shiftMonth(start, -1))}>‹</button>
        <strong>{format(parseISO(start), "MMMM yyyy")}</strong>
        <button type="button" onClick={() => setStart(shiftMonth(start, 1))}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}${index}`}>{day}</span>)}
        {days.map((day, index) => (
          <button type="button" key={`${day.iso || "blank"}-${index}`} className={day.iso && day.iso >= start && day.iso <= end ? "rounded-full bg-[var(--accent)] text-white" : ""} onClick={() => { if (!day.iso) return; if (!start || day.iso < start) setStart(day.iso); setEnd(day.iso); }}>{day.label}</button>
        ))}
      </div>
      <p className="text-sm font-medium">Time for the reminding</p>
      <div className="flex gap-2">
        <input aria-label="First time" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="rounded-full border border-[var(--line)] px-3 py-2" />
        <input aria-label="Second time" type="time" value={second} onChange={(event) => setSecond(event.target.value)} className="rounded-full border border-[var(--line)] px-3 py-2" />
      </div>
      <select aria-label="Repeat" value={repeat} onChange={(event) => setRepeat(event.target.value as typeof repeat)} className="rounded-full border border-[var(--line)] px-3 py-2">
        <option value="none">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      <button className="rounded-full bg-[var(--surface-2)] py-2" type="submit">Save reminder</button>
    </form>
  );
}

function monthDays(iso: string) {
  const date = parseISO(iso);
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ label: string; iso: string }> = Array.from({ length: first }, () => ({ label: "", iso: "" }));
  for (let day = 1; day <= count; day += 1) {
    const value = new Date(year, month, day);
    cells.push({ label: String(day), iso: format(value, "yyyy-MM-dd") });
  }
  return cells;
}

function shiftMonth(iso: string, delta: number) {
  const date = parseISO(iso);
  return format(new Date(date.getFullYear(), date.getMonth() + delta, 1), "yyyy-MM-dd");
}

function Templates({ workspaceId, onCreated }: { workspaceId: string; onCreated: (id: string) => void }) {
  const templates = useQuery({ queryKey: ["templates", workspaceId], queryFn: async () => (await api<Template[]>(`/api/v1/templates?workspaceId=${workspaceId}`)).data });
  return (
    <div className="flex-1 overflow-auto p-6">
      <h1 className="text-3xl font-semibold">Templates</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {templates.data?.map((template) => (
          <button key={template.id} className="rounded-[24px] bg-[var(--surface-2)] p-4 text-left" onClick={() => void api<Note>(`/api/v1/templates/${template.id}/use`, { method: "POST", body: JSON.stringify({ workspaceId }) }).then((result) => onCreated(result.data.id))}>
            <span className="text-2xl">{template.emoji}</span>
            <h2 className="mt-2 font-semibold">{template.name}</h2>
            <p className="text-sm text-[var(--ink-soft)]">{template.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ImportPanel({ workspaceId }: { workspaceId: string }) {
  const [report, setReport] = useState<string>("");
  return (
    <div className="flex-1 p-6">
      <h1 className="text-3xl font-semibold">Import</h1>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">Markdown, text, HTML, JSON, or Evernote .enex.</p>
      <input className="mt-4" aria-label="Import file" type="file" accept=".md,.txt,.html,.json,.enex" onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const data = new FormData();
        data.set("file", file);
        data.set("workspaceId", workspaceId);
        const token = useAuth.getState().accessToken;
        void fetch("/api/v1/import", { method: "POST", body: data, headers: token ? { Authorization: `Bearer ${token}` } : {} })
          .then((response) => response.json())
          .then((body: { data: { created: number; failed: Array<{ message: string }> } }) => setReport(`Created ${body.data.created}. ${body.data.failed.map((item) => item.message).join(" ")}`));
      }} />
      {report ? <p className="mt-3 text-sm">{report}</p> : null}
    </div>
  );
}

function CalendarPanel({ workspaceId, notes, onOpen }: { workspaceId: string; notes: Note[]; onOpen: (id: string) => void }) {
  const reminders = useQuery({ queryKey: ["reminders", workspaceId], queryFn: async () => (await api<Reminder[]>(`/api/v1/reminders?workspaceId=${workspaceId}`)).data });
  return (
    <div className="flex-1 overflow-auto p-6">
      <h1 className="text-3xl font-semibold">Calendar</h1>
      <ul className="mt-4 grid gap-2">
        {reminders.data?.map((reminder) => (
          <li key={reminder.id} className="flex items-center justify-between rounded-2xl bg-[var(--surface-2)] px-3 py-2 text-sm">
            <button onClick={() => onOpen(reminder.noteId)}>{reminder.startDate} · {reminder.times.join(", ")} · {reminder.status}</button>
            <button onClick={() => void api(`/api/v1/reminders/${reminder.id}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) })}>Done</button>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 font-semibold">Recent notes</h2>
      <ul>{notes.slice(0, 8).map((note) => <li key={note.id}><button onClick={() => onOpen(note.id)}>{note.title || "Untitled"}</button></li>)}</ul>
    </div>
  );
}

function Settings({ onToast }: { onToast: (message: string) => void }) {
  const user = useAuth((state) => state.user);
  const ui = useUi();
  const [name, setName] = useState(user?.name ?? "");
  return (
    <div className="flex-1 overflow-auto p-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <div className="mt-4 grid max-w-lg gap-4">
        <label className="grid gap-1 text-sm">Theme
          <select value={ui.theme} onChange={(event) => ui.setTheme(event.target.value as "system" | "light" | "dark")} className="rounded-2xl border border-[var(--line)] px-3 py-2">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">Accent
          <input aria-label="Accent color" type="color" value={ui.accent} onChange={(event) => ui.setAccent(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Editor size
          <input type="range" min={15} max={22} value={ui.fontScale} onChange={(event) => ui.setFontScale(Number(event.target.value))} />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ui.reducedTransparency} onChange={(event) => ui.setReducedTransparency(event.target.checked)} /> Reduced transparency</label>
        <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); void api("/api/v1/auth/me", { method: "PATCH", body: JSON.stringify({ name }) }).then(() => onToast("Profile saved")); }}>
          <input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} className="rounded-2xl border border-[var(--line)] px-3 py-2" />
          <button className="rounded-full bg-[var(--ink)] px-4 py-2 text-white" type="submit">Save profile</button>
        </form>
        <p className="text-sm text-[var(--ink-soft)]">Plan: {user?.plan}{user?.trialEndsAt ? ` until ${user.trialEndsAt.slice(0, 10)}` : ""}</p>
        <button className="text-left text-sm text-[var(--danger)]" onClick={() => {
          const password = window.prompt("Confirm your password to delete the account");
          if (!password) return;
          void api("/api/v1/auth/me", { method: "DELETE", body: JSON.stringify({ password }) }).then(() => { useAuth.getState().clear(); window.location.href = "/"; });
        }}>Delete account</button>
      </div>
    </div>
  );
}

function CommandList({ notes, onPick }: { notes: Note[]; onPick: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const matches = notes.filter((note) => note.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  return (
    <div>
      <input autoFocus aria-label="Command search" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-full border border-[var(--line)] px-3 py-2" placeholder="Search notes or actions" />
      <div className="mt-3 grid">
        {matches.map((note) => <button key={note.id} className="rounded-xl px-2 py-2 text-left" onClick={() => onPick(note.id)}>{note.title || "Untitled"}</button>)}
        <Link className="rounded-xl px-2 py-2" to="/app?section=templates">Open templates</Link>
        <Link className="rounded-xl px-2 py-2" to="/app?section=trash">Open trash</Link>
      </div>
    </div>
  );
}

function MobileTabs({ onCreate }: { onCreate: () => void }) {
  return (
    <nav className="glass-strong grid grid-cols-5 items-center border-t border-white/40 px-2 py-2 text-[11px]" aria-label="Primary">
      <Link className="grid place-items-center" to="/app"><AppIcon name="file" className="h-5 w-5" />Notes</Link>
      <Link className="grid place-items-center" to="/app?section=search"><AppIcon name="search" className="h-5 w-5" />Search</Link>
      <button aria-label="New page" className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--ink)] text-white" onClick={onCreate}><Plus /></button>
      <Link className="grid place-items-center" to="/app?section=calendar"><AppIcon name="calendar" className="h-5 w-5" />Calendar</Link>
      <Link className="grid place-items-center" to="/app?section=settings"><AppIcon name="user" className="h-5 w-5" />Profile</Link>
    </nav>
  );
}

export function PublicNote() {
  const token = window.location.pathname.split("/p/")[1] ?? "";
  const note = useQuery({ queryKey: ["public", token], queryFn: async () => (await api<Note>(`/api/v1/public/notes/${token}`)).data });
  if (!note.data) return <p className="p-8">Loading…</p>;
  return (
    <article className="mx-auto max-w-2xl p-8">
      <h1 className="text-4xl font-semibold">{note.data.emoji} {note.data.title}</h1>
      <NoteBody content={note.data.content} editable={false} onChange={() => undefined} onUploadImage={async () => ""} />
    </article>
  );
}

export function UiDemo() {
  return (
    <div className="app-bg min-h-svh p-8">
      <div className="blob blob-a" /><div className="blob blob-b" />
      <h1 className="relative text-3xl font-semibold">UI kit</h1>
      <div className="relative mt-6 flex flex-wrap gap-4">
        <GlassSurface className="rounded-[24px] p-6">Glass</GlassSurface>
        <GlassSurface variant="glass-strong" className="rounded-[28px] p-6">Strong</GlassSurface>
        <GlassSurface variant="glass-accent" interactive className="w-64 rounded-[24px] p-6">Selected card</GlassSurface>
        <button className="glass rounded-full px-5 py-3">Glass button</button>
        <button className="rounded-full bg-[var(--ink)] px-5 py-3 text-white">Primary</button>
      </div>
    </div>
  );
}
