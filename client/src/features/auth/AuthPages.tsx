import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { GlassSurface } from "../../components/GlassSurface";
import { api } from "../../lib/api";
import { useAuth } from "../../store/auth";
import type { User } from "../../types/api";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

function Field({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span>{label}</span>
      <input className="rounded-2xl border border-[var(--line)] bg-white/70 px-3 py-2.5" {...props} />
      {error ? <span className="text-[var(--danger)]">{error}</span> : null}
    </label>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="app-bg grid min-h-svh place-items-center px-4">
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <GlassSurface variant="glass-strong" className="relative z-10 w-full max-w-md rounded-[28px] p-6">
        <Link to="/" className="text-sm font-semibold">Stash</Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-5">{children}</div>
      </GlassSurface>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const form = useForm<{ email: string; password: string }>({ defaultValues: { email: "", password: "" } });
  return (
    <Shell title="Welcome back">
      <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
        const parsed = loginSchema.safeParse(values);
        if (!parsed.success) {
          form.setError("email", { message: parsed.error.issues[0]?.message });
          return;
        }
        const result = await api<{ user: User; accessToken: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(parsed.data) });
        useAuth.getState().setSession(result.data.user, result.data.accessToken);
        navigate("/app");
      })}>
        <Field label="Email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} />
        <Field label="Password" type="password" autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register("password")} />
        <button className="rounded-full bg-[var(--ink)] py-2.5 font-semibold text-white" type="submit">Log in</button>
      </form>
      <p className="mt-4 text-sm text-[var(--ink-soft)]"><Link to="/forgot">Forgot password</Link> · <Link to="/signup">Create an account</Link></p>
    </Shell>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plan = params.get("plan");
  const form = useForm<{ name: string; email: string; password: string }>({ defaultValues: { name: "", email: "", password: "" } });
  return (
    <Shell title={plan === "pro" || plan === "team" ? `Start your ${plan} trial` : "Create your notebook"}>
      <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
        const parsed = registerSchema.safeParse(values);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          const key = (issue?.path[0] ?? "email") as "name" | "email" | "password";
          form.setError(key, { message: issue?.message });
          return;
        }
        const result = await api<{ user: User; accessToken: string }>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(parsed.data) });
        useAuth.getState().setSession(result.data.user, result.data.accessToken);
        if (plan === "pro" || plan === "team") {
          const updated = await api<User>("/api/v1/auth/plan", { method: "POST", body: JSON.stringify({ plan }) });
          useAuth.getState().setUser(updated.data);
        }
        navigate("/app");
      })}>
        <Field label="Name" autoComplete="name" error={form.formState.errors.name?.message} {...form.register("name")} />
        <Field label="Email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} />
        <Field label="Password" type="password" autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register("password")} />
        <button className="glass rounded-full py-2.5 font-semibold" type="submit">{plan === "pro" || plan === "team" ? "Create account and start trial" : "Create account"}</button>
      </form>
      <p className="mt-4 text-sm"><Link to="/login">I already have an account</Link></p>
    </Shell>
  );
}

export function ForgotPage() {
  const form = useForm<{ email: string }>({ defaultValues: { email: "" } });
  const [sent, setSent] = useState(false);
  return (
    <Shell title="Reset your password">
      <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
        await api("/api/v1/auth/forgot", { method: "POST", body: JSON.stringify(values) });
        form.reset();
        setSent(true);
      })}>
        <Field label="Email" type="email" {...form.register("email")} />
        <button className="rounded-full bg-[var(--ink)] py-2.5 font-semibold text-white" type="submit">Send reset link</button>
        {sent ? <p className="text-sm">If that email has an account, the reset link is on its way. In development it is also written to the API log.</p> : null}
      </form>
    </Shell>
  );
}

export function ResetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const form = useForm<{ password: string }>({ defaultValues: { password: "" } });
  return (
    <Shell title="Choose a new password">
      <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
        await api("/api/v1/auth/reset", { method: "POST", body: JSON.stringify({ token: params.get("token"), password: values.password }) });
        navigate("/login");
      })}>
        <Field label="New password" type="password" {...form.register("password")} />
        <button className="rounded-full bg-[var(--ink)] py-2.5 font-semibold text-white" type="submit">Update password</button>
      </form>
    </Shell>
  );
}
