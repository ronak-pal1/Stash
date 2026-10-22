import {
  Bell,
  Braces,
  Calendar,
  ChevronDown,
  CircleHelp,
  Code,
  Download,
  FileText,
  Folder,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Music,
  Search,
  StickyNote,
  UserRound,
  type LucideIcon,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  "sticky-note": StickyNote,
  "list-checks": ListChecks,
  megaphone: Megaphone,
  music: Music,
  "circle-help": CircleHelp,
  "layout-dashboard": LayoutDashboard,
  code: Code,
  braces: Braces,
  folder: Folder,
  notebook: StickyNote,
  bell: Bell,
  download: Download,
  search: Search,
  calendar: Calendar,
  file: FileText,
  user: UserRound,
};

export function AppIcon({ name, className }: { name: string; className?: string }) {
  const Icon = map[name] ?? Folder;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}

export { ChevronDown };
