"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { VoiceButton } from "@/components/VoiceButton";

export function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <>
      <Nav />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</div>
      <VoiceButton />
    </>
  );
}
