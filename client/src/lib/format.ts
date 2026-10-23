import { formatDistanceToNowStrict } from "date-fns";

export const relativeTime = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(date, { addSuffix: false })
    .replace(" seconds", " sec")
    .replace(" second", " sec")
    .replace(" minutes", " min")
    .replace(" minute", " min")
    .replace(" hours", " hr")
    .replace(" hour", " hr");
};

export const readingLabel = (minutes: number) => (minutes <= 0 ? "Empty" : `${minutes} min read`);

export const highlight = (text: string, query: string) => {
  if (!query.trim()) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${safe})`, "ig"), "«$1»");
};

export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
