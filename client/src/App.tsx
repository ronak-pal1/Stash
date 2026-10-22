import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LiquidDefs } from "./components/LiquidDefs";
import { ForgotPage, LoginPage, ResetPage, SignupPage } from "./features/auth/AuthPages";
import { PublicNote, UiDemo, WorkspaceApp } from "./features/app/WorkspaceApp";
import { Landing } from "./features/marketing/Landing";
import { api } from "./lib/api";
import { useAuth } from "./store/auth";
import { useUi } from "./store/ui";
import type { User } from "./types/api";

const queryClient = new QueryClient();

function Theme() {
  const theme = useUi((state) => state.theme);
  const accent = useUi((state) => state.accent);
  const fontScale = useUi((state) => state.fontScale);
  const reduced = useUi((state) => state.reducedTransparency);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--editor-size", `${fontScale}px`);
    root.classList.toggle("reduce-transparency", reduced);
    const viewport = window.visualViewport;
    const onViewport = () => {
      if (!viewport) return;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--keyboard-inset", `${inset}px`);
    };
    viewport?.addEventListener("resize", onViewport);
    viewport?.addEventListener("scroll", onViewport);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    const refract = CSS.supports("backdrop-filter", "url(#liquid-glass)") || CSS.supports("-webkit-backdrop-filter", "url(#liquid-glass)");
    if (refract) root.classList.add("glass-refract");
    return () => {
      media.removeEventListener("change", apply);
      viewport?.removeEventListener("resize", onViewport);
      viewport?.removeEventListener("scroll", onViewport);
    };
  }, [theme, accent, fontScale, reduced]);
  return null;
}

function Boot() {
  const setSession = useAuth((state) => state.setSession);
  const setReady = useAuth((state) => state.setReady);
  useEffect(() => {
    void api<{ user: User; accessToken: string }>("/api/v1/auth/refresh", { method: "POST", headers: { "x-stash-client": "web" } })
      .then((result) => setSession(result.data.user, result.data.accessToken))
      .catch(() => setReady(true));
  }, [setReady, setSession]);
  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const ready = useAuth((state) => state.ready);
  const user = useAuth((state) => state.user);
  if (!ready) return <p className="p-8">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LiquidDefs />
      <Theme />
      <Boot />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot" element={<ForgotPage />} />
          <Route path="/reset-password" element={<ResetPage />} />
          <Route path="/p/:token" element={<PublicNote />} />
          <Route path="/dev/ui" element={<UiDemo />} />
          <Route path="/app" element={<RequireAuth><WorkspaceApp /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
