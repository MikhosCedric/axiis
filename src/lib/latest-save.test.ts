import { describe, expect, it } from "vitest";
import { latestSave } from "./latest-save";

/** A save that stays open until the test lets it land, recording what it was asked to send. */
function held() {
  const sent: string[] = [];
  const landing: (() => void)[] = [];
  const save = (_key: string, value: string) => {
    sent.push(value);
    return new Promise<{ ok: true }>((resolve) => landing.push(() => resolve({ ok: true })));
  };
  return { sent, save, land: () => landing.shift()!() };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("latestSave", () => {
  it("sends the first value at once", async () => {
    const h = held();
    const call = latestSave(h.save)("work", "clay");
    expect(h.sent).toEqual(["clay"]);
    h.land();
    expect(await call).toEqual({ ok: true });
  });

  it("holds back the values chosen in between and sends only the last once the first lands", async () => {
    const h = held();
    const save = latestSave(h.save);
    const first = save("work", "clay");
    const second = save("work", "ochre");
    const third = save("work", "moss");
    expect(await second).toEqual({ ok: true });
    expect(await third).toEqual({ ok: true });
    expect(h.sent).toEqual(["clay"]);
    h.land();
    await settle();
    expect(h.sent).toEqual(["clay", "moss"]);
    h.land();
    expect(await first).toEqual({ ok: true });
  });

  it("does not send again when the last value is the one already sent", async () => {
    const h = held();
    const save = latestSave(h.save);
    const first = save("work", "clay");
    void save("work", "moss");
    void save("work", "clay");
    h.land();
    expect(await first).toEqual({ ok: true });
    expect(h.sent).toEqual(["clay"]);
  });

  it("keeps keys apart", async () => {
    const h = held();
    const save = latestSave(h.save);
    void save("work", "clay");
    void save("home", "moss");
    expect(h.sent).toEqual(["clay", "moss"]);
  });

  it("stops at a failed save and lets the next choice send afresh", async () => {
    const sent: string[] = [];
    const save = latestSave(async (_k: string, v: string) => {
      sent.push(v);
      return v === "clay" ? ({ ok: false, error: "no" } as const) : ({ ok: true } as const);
    });
    expect(await save("work", "clay")).toEqual({ ok: false, error: "no" });
    expect(await save("work", "moss")).toEqual({ ok: true });
    expect(sent).toEqual(["clay", "moss"]);
  });
});
