"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Login failed");
        return;
      }
      router.replace(params.get("from") || "/");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-slate-950 px-6 py-12 text-slate-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-8 shadow-2xl"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
          FF-IVY
        </p>
        <h1 className="mt-2 text-3xl font-bold">Chameleon care diary</h1>
        <p className="mt-3 text-slate-300">
          Enter the shared household password to open the tablet app.
        </p>
        <label className="mt-8 block text-sm font-medium text-slate-200">
          Password
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-4 text-lg outline-none ring-emerald-400 focus:ring-2"
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading || !password}
          className="mt-6 w-full rounded-2xl bg-emerald-500 px-4 py-4 text-lg font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Open diary"}
        </button>
      </form>
    </main>
  );
}
