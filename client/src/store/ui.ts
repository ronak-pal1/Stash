import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark";

interface UiState {
  theme: ThemeMode;
  accent: string;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  shortcutHelp: boolean;
  workspaceId: string | null;
  noteId: string | null;
  folderId: string | null;
  reducedTransparency: boolean;
  fontScale: number;
  editorFont: "sans" | "serif";
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: string) => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setShortcutHelp: (open: boolean) => void;
  setWorkspaceId: (id: string | null) => void;
  setNoteId: (id: string | null) => void;
  setFolderId: (id: string | null) => void;
  setReducedTransparency: (value: boolean) => void;
  setFontScale: (value: number) => void;
  setEditorFont: (value: "sans" | "serif") => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      accent: "#6EC6F5",
      sidebarCollapsed: false,
      commandOpen: false,
      shortcutHelp: false,
      workspaceId: null,
      noteId: null,
      folderId: null,
      reducedTransparency: false,
      fontScale: 17,
      editorFont: "sans",
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setShortcutHelp: (shortcutHelp) => set({ shortcutHelp }),
      setWorkspaceId: (workspaceId) => set({ workspaceId }),
      setNoteId: (noteId) => set({ noteId }),
      setFolderId: (folderId) => set({ folderId }),
      setReducedTransparency: (reducedTransparency) => set({ reducedTransparency }),
      setFontScale: (fontScale) => set({ fontScale }),
      setEditorFont: (editorFont) => set({ editorFont }),
    }),
    { name: "stash-ui" },
  ),
);
