import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce } from "./csp";

const directive = (policy: string, name: string) => policy.split("; ").find((d) => d.startsWith(`${name} `));

describe("contentSecurityPolicy", () => {
  const prod = contentSecurityPolicy("abc123", { development: false });
  const dev = contentSecurityPolicy("abc123", { development: true });

  it("allows scripts only by nonce, without unsafe-inline or eval in production", () => {
    expect(directive(prod, "script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(prod).not.toContain("unsafe-eval");
  });

  it("adds eval and the reload socket in development only", () => {
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toBe("connect-src 'self' ws: wss:");
    expect(directive(prod, "connect-src")).toBe("connect-src 'self'");
  });

  it("forbids framing, plugins and a rewritten base", () => {
    for (const rule of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]) expect(prod).toContain(rule);
  });

  it("upgrades insecure requests in production only", () => {
    expect(prod).toContain("upgrade-insecure-requests");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
});

describe("newNonce", () => {
  it("is base64 of 16 bytes and differs each call", () => {
    const a = newNonce();
    expect(atob(a)).toHaveLength(16);
    expect(a).not.toBe(newNonce());
  });
});
