import { ArrowRight, Check, Lock, Search, Share2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { GlassSurface } from "../../components/GlassSurface";
import { t } from "../../lib/messages";

const plans = [
  { name: "Free", price: "$0", detail: "For a personal notebook", items: ["1 workspace", "Unlimited notes", "3 members", "7-day trash"], plan: "free" },
  { name: "Pro", price: "$8", detail: "14-day trial, then stay on Pro in settings", items: ["5 workspaces", "Version history", "10 members", "Reminders and push"], plan: "pro" },
  { name: "Team", price: "$16", detail: "For a shared workspace", items: ["50 workspaces", "Roles and invites", "100 members", "Public links"], plan: "team" },
];

export function Landing() {
  return (
    <div className="app-bg">
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          {t("brand")}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#features">Features</a>
          <a href="#pricing">{t("pricing")}</a>
          <Link to="/login">{t("login")}</Link>
          <Link to="/signup" className="glass rounded-full px-4 py-2 font-semibold">{t("signup")}</Link>
        </nav>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-20">
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="mb-3 text-sm font-medium text-[var(--ink-soft)]">Notes, lists, and reminders</p>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-0.045em] md:text-6xl">Write it down. Find it later. Share it when it is ready.</h1>
            <p className="mt-5 max-w-lg text-lg text-[var(--ink-soft)]">{t("tagline")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="glass inline-flex items-center gap-2 rounded-full px-5 py-3 font-semibold">
                Start free <ArrowRight size={16} />
              </Link>
              <Link to="/signup?plan=pro" className="rounded-full bg-[var(--ink)] px-5 py-3 font-semibold text-white">Start Pro trial</Link>
            </div>
          </div>
          <GlassSurface variant="glass-strong" className="rounded-[36px] p-4">
            <div className="rounded-[28px] bg-[var(--surface)] p-4">
              <div className="mb-4 flex items-center justify-between text-sm">
                <strong>Write down your ideas</strong>
                <span className="text-[var(--muted)]">#ideas</span>
              </div>
              <p className="text-[var(--ink-soft)]">A page for the thought you will want tomorrow morning.</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-2">setup meeting</span>
                <span className="rounded-full bg-[var(--surface-2)] px-3 py-2">check to-dos</span>
              </div>
            </div>
          </GlassSurface>
        </section>
        <section id="features" className="grid gap-4 py-10 md:grid-cols-4">
          {[
            [Search, "Search that keeps up", "Title, body, and hashtags, with filters for lists, images, and voice."],
            [Sparkles, "Pages, not files", "Folders you can rename, templates, and a real editor."],
            [Share2, "Share with a role", "Viewers and editors, plus a public link you can revoke."],
            [Lock, "Yours until you share it", "Note passwords, trash for 30 days, and a session that stays in a cookie."],
          ].map(([Icon, title, copy]) => (
            <GlassSurface key={String(title)} className="rounded-[24px] p-5">
              <Icon size={18} />
              <h2 className="mt-3 font-semibold">{String(title)}</h2>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">{String(copy)}</p>
            </GlassSurface>
          ))}
        </section>
        <section id="pricing" className="py-10">
          <h2 className="text-3xl font-semibold tracking-tight">Pricing</h2>
          <p className="mt-2 max-w-xl text-[var(--ink-soft)]">Start free. A Pro or Team trial is a real plan on your account for 14 days. There is no card form because billing is not connected.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <GlassSurface key={plan.name} variant={plan.name === "Pro" ? "glass-accent" : "glass-strong"} className="rounded-[28px] p-5">
                <p className="text-sm">{plan.name}</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">{plan.price}<span className="text-base font-medium">/mo</span></p>
                <p className="mt-2 text-sm opacity-80">{plan.detail}</p>
                <ul className="mt-4 grid gap-2 text-sm">
                  {plan.items.map((item) => <li key={item} className="flex items-center gap-2"><Check size={14} />{item}</li>)}
                </ul>
                <Link to={plan.plan === "free" ? "/signup" : `/signup?plan=${plan.plan}`} className="mt-5 inline-flex rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white">
                  {plan.plan === "free" ? "Create a free account" : `Start ${plan.name} trial`}
                </Link>
              </GlassSurface>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
