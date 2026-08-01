"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

const POLL_INTERVAL_MS = 60_000;

export function usePollingFetch<T>(url: string, initialData: T): T {
  const [polledData, setPolledData] = useState<T | null>(null);
  const [baseline, setBaseline] = useState(initialData);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Reset to the latest server snapshot when navigation/props change.
  if (initialData !== baseline) {
    setBaseline(initialData);
    setPolledData(null);
  }

  const data = polledData ?? initialData;

  const fetchSnapshot = useEffectEvent(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return;
      const json = (await res.json()) as T;
      if (requestId !== requestIdRef.current) return;
      setPolledData(json);
    } catch {
      // Keep last good snapshot on network/abort errors.
    }
  });

  useEffect(() => {
    function pollIfVisible() {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchSnapshot();
    }

    function onVisibilityChange() {
      if (!document.hidden) void fetchSnapshot();
    }

    const intervalId = window.setInterval(pollIfVisible, POLL_INTERVAL_MS);
    window.addEventListener("focus", pollIfVisible);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", pollIfVisible);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      abortRef.current?.abort();
      requestIdRef.current += 1;
    };
  }, [url]);

  return data;
}
