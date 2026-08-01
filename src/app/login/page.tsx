import { Suspense } from "react";
import LoginPage from "./page-client";

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-full flex-1 items-center justify-center bg-slate-950 text-slate-50">
          Loading…
        </main>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
