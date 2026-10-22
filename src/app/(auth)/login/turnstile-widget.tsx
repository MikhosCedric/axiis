"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SCRIPT } from "@/lib/turnstile";

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: "interaction-only";
      size: "flexible";
      theme: "auto";
      callback(): void;
      "expired-callback"(): void;
      "error-callback"(): void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare's managed check. It stays invisible unless Cloudflare wants a click, and adds the
 * hidden `cf-turnstile-response` field to the form it sits in. A token works once, so a new
 * `attempt` (each answer from the server) asks for a fresh one.
 */
export function TurnstileWidget({ siteKey, nonce, attempt }: { siteKey: string; nonce?: string; attempt: unknown }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(() => typeof window !== "undefined" && window.turnstile !== undefined);

  useEffect(() => {
    const api = window.turnstile;
    if (!loaded || !api || !container.current || widget.current) return;
    widget.current = api.render(container.current, {
      sitekey: siteKey,
      appearance: "interaction-only",
      size: "flexible",
      theme: "auto",
      callback: () => setProblem(null),
      "expired-callback": () => setProblem("The check that you are a person expired. It is running again."),
      "error-callback": () => setProblem("The check that you are a person could not run. Reload the page and try again."),
    });
    return () => {
      if (widget.current) api.remove(widget.current);
      widget.current = null;
    };
  }, [loaded, siteKey]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [attempt]);

  return (
    <>
      <Script src={TURNSTILE_SCRIPT} nonce={nonce} strategy="afterInteractive" onReady={() => setLoaded(true)} />
      <div ref={container} />
      {problem && (
        <p role="status" className="text-sm text-ink">
          {problem}
        </p>
      )}
    </>
  );
}
