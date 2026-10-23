import { motion, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { cn } from "../lib/cn";

type Variant = "glass" | "glass-strong" | "glass-accent" | "glass-dark";

export function GlassSurface({
  variant = "glass",
  className,
  children,
  interactive = false,
}: {
  variant?: Variant;
  className?: string;
  children?: ReactNode;
  interactive?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const onMove = (event: React.PointerEvent) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    node.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  };
  return (
    <motion.div
      ref={ref}
      className={cn(variant, "overflow-hidden", className)}
      onPointerMove={onMove}
      whileHover={interactive && !reduce ? { scale: 1.02 } : undefined}
      whileTap={interactive && !reduce ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <div className="relative z-[3] h-full">{children}</div>
    </motion.div>
  );
}
