import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { initials } from "../lib/format";
import { GlassSurface } from "./GlassSurface";

export function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "glass" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-[var(--ink)] text-white",
    glass: "",
    ghost: "bg-transparent",
    danger: "bg-[var(--danger)] text-white",
  }[variant];
  if (variant === "glass") {
    return (
      <button type={type} className={cn("glass rounded-full px-4 py-2 text-sm font-semibold", className)} {...props}>
        {children}
      </button>
    );
  }
  return (
    <button type={type} className={cn("rounded-full px-4 py-2 text-sm font-semibold", styles, className)} {...props}>
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cn("grid h-9 w-9 place-items-center rounded-full hover:bg-black/5", className)} {...props}>
      {children}
    </button>
  );
}

export function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const id = useId();
  return (
    <label className="grid gap-1 text-sm" htmlFor={id}>
      {label ? <span className="font-medium text-[var(--ink-soft)]">{label}</span> : null}
      <input id={id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 outline-none" {...props} />
    </label>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
      <button className="absolute inset-0 bg-[#111318]/30" aria-label="Close dialog" onClick={onClose} />
      <GlassSurface variant="glass-strong" className="relative z-10 w-full max-w-lg rounded-[28px] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>×</IconButton>
        </div>
        {children}
      </GlassSurface>
    </div>
  );
}

export function Avatar({ name, src, size = 28 }: { name: string; src?: string | null; size?: number }) {
  return src ? (
    <img src={src} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid place-items-center rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--ink)]" style={{ width: size, height: size }} aria-hidden>
      {initials(name || "?")}
    </span>
  );
}

export function AvatarStack({ people }: { people: Array<{ id: string; name: string }> }) {
  return (
    <div className="flex -space-x-2">
      {people.slice(0, 3).map((person) => (
        <span key={person.id} title={person.name} className="ring-2 ring-white rounded-full">
          <Avatar name={person.name} />
        </span>
      ))}
    </div>
  );
}

export function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", active ? "bg-[var(--ink)] text-white" : "bg-[var(--accent-soft)] text-[var(--ink)]")}>
      {children}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-black/5", className)} />;
}

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <GlassSurface variant="glass-dark" className="rounded-full px-4 py-2 text-sm">
        <button onClick={onClose}>{message}</button>
      </GlassSurface>
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span role="tooltip" className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded-full bg-[var(--ink)] px-2 py-1 text-[11px] text-white group-hover:block">
        {label}
      </span>
    </span>
  );
}

export function Dropdown({ label, children }: { label: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="relative">
      <summary className="list-none cursor-pointer">{label}</summary>
      <div className="absolute left-0 z-30 mt-2 min-w-44">{children}</div>
    </details>
  );
}

export function MenuPanel({ children }: { children: ReactNode }) {
  return (
    <GlassSurface variant="glass-strong" className="rounded-2xl p-1 text-sm shadow-lg">
      <div className="grid">{children}</div>
    </GlassSurface>
  );
}

export function MenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="rounded-xl px-3 py-2 text-left hover:bg-black/5" onClick={onClick}>
      {children}
    </button>
  );
}
