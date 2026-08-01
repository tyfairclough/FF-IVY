"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/insects", label: "Insects" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            FF-IVY
          </p>
          <h1 className="text-lg font-bold text-white">Care diary</h1>
        </div>
        <nav className="flex flex-1 justify-center gap-2">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-2xl px-5 py-3 text-base font-semibold transition ${
                  active
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Lock
        </button>
      </div>
    </header>
  );
}
