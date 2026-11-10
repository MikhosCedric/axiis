"use client";

/**
 * The inline script that sets the saved theme before first paint. It is emitted in the server HTML only: React
 * never runs a script it renders on the client, and logs an error if it is asked to (which `next dev` does when it
 * re-renders the root layout for a `notFound()` thrown outside a stream, as on /item/<bad key>). The browser has
 * already run it by then, so rendering nothing on the client loses nothing.
 */
export function ThemeScript({ code, nonce }: { code: string; nonce?: string }) {
  if (typeof window !== "undefined") return null;
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: code }} />;
}
