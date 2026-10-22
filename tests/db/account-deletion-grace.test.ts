import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type Tx } from "./harness";
import { countOwned, seedWorld, TABLES } from "./fixtures";

let db: TestDb;
let a: string;
let b: string;

const asService = <T>(fn: (tx: Tx) => Promise<T>) =>
  db.admin.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    return fn(tx);
  });

const userExists = async (id: string) =>
  (await db.admin.query("select 1 from auth.users where id = $1", [id])).rows.length === 1;

const requestOf = async (id: string) =>
  (await db.admin.query<{ requested_at: Date }>("select requested_at from public.account_deletions where user_id = $1", [id]))
    .rows[0]?.requested_at;

/** A request made `days` ago, written past the trigger the way a support script would. */
const requestedDaysAgo = (id: string, days: number) =>
  db.seed("insert into public.account_deletions (user_id, requested_at) values ($1, now() - make_interval(days => $2))", [
    id,
    days,
  ]);

beforeEach(async () => {
  db = await createTestDb();
  a = (await seedWorld(db, await db.createUser())).userId;
  b = (await seedWorld(db, await db.createUser())).userId;
});

describe("account_deletions row-level security", () => {
  it("lets the owner request, read and withdraw their own deletion", async () => {
    await db.asUser(a, (tx) => tx.query("insert into public.account_deletions default values"));
    const seen = await db.asUser(a, (tx) => tx.query<{ user_id: string }>("select user_id from public.account_deletions"));
    expect(seen.rows).toEqual([{ user_id: a }]);

    await db.asUser(a, (tx) => tx.query("delete from public.account_deletions"));
    expect(await requestOf(a)).toBeUndefined();
  });

  it("stamps the database's time, whatever requested_at the client sends", async () => {
    await db.asUser(a, (tx) => tx.query("insert into public.account_deletions (requested_at) values ('2000-01-01')"));
    expect(Date.now() - (await requestOf(a))!.getTime()).toBeLessThan(60_000);
  });

  it("refuses a request made for another user", async () => {
    await expect(
      db.asUser(a, (tx) => tx.query("insert into public.account_deletions (user_id) values ($1)", [b])),
    ).rejects.toThrow(/row-level security/);
    expect(await requestOf(b)).toBeUndefined();
  });

  it("hides another user's request and cannot withdraw it", async () => {
    await requestedDaysAgo(b, 1);
    const seen = await db.asUser(a, (tx) => tx.query("select * from public.account_deletions"));
    expect(seen.rows).toEqual([]);
    await db.asUser(a, (tx) => tx.query("delete from public.account_deletions where user_id = $1", [b]));
    expect(await requestOf(b)).toBeDefined();
  });

  it("allows no update, so a request cannot be moved", async () => {
    await db.asUser(a, (tx) => tx.query("insert into public.account_deletions default values"));
    await expect(
      db.asUser(a, (tx) => tx.query("update public.account_deletions set requested_at = '2000-01-01'")),
    ).rejects.toThrow(/permission denied/);
  });

  it("gives anon nothing", async () => {
    await expect(db.asAnon((tx) => tx.query("select * from public.account_deletions"))).rejects.toThrow(/permission denied/);
    await expect(db.asAnon((tx) => tx.query("insert into public.account_deletions default values"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("goes with the account when it is deleted at once", async () => {
    await db.asUser(a, (tx) => tx.query("insert into public.account_deletions default values"));
    await db.asUser(a, (tx) => tx.query("select public.delete_my_account()"));
    expect(await requestOf(a)).toBeUndefined();
  });
});

describe("purge_due_accounts", () => {
  it("deletes accounts asked for 14 or more days ago with all their rows, and keeps the rest", async () => {
    const c = (await seedWorld(db, await db.createUser())).userId;
    await requestedDaysAgo(a, 15);
    await requestedDaysAgo(b, 13);

    const { rows } = await asService((tx) => tx.query<{ n: number }>("select public.purge_due_accounts() as n"));

    expect(rows[0].n).toBe(1);
    expect(await userExists(a)).toBe(false);
    for (const table of TABLES) expect(await countOwned(db, table, a)).toBe(0);
    expect(await requestOf(a)).toBeUndefined();
    expect(await userExists(b)).toBe(true);
    expect(await requestOf(b)).toBeDefined();
    expect(await userExists(c)).toBe(true);
    for (const table of TABLES) expect(await countOwned(db, table, c)).toBeGreaterThan(0);
  });

  it("does nothing to an account whose request was withdrawn", async () => {
    await requestedDaysAgo(a, 20);
    await db.asUser(a, (tx) => tx.query("delete from public.account_deletions"));
    await asService((tx) => tx.query("select public.purge_due_accounts()"));
    expect(await userExists(a)).toBe(true);
  });

  it("is denied to authenticated, even for an account that is due, and to anon", async () => {
    await requestedDaysAgo(a, 30);
    await expect(db.asUser(a, (tx) => tx.query("select public.purge_due_accounts()"))).rejects.toThrow(/permission denied/);
    await expect(db.asAnon((tx) => tx.query("select public.purge_due_accounts()"))).rejects.toThrow(/permission denied/);
    expect(await userExists(a)).toBe(true);
  });

  it("grants execute to service_role only", async () => {
    const { rows } = await db.admin.query<{ grantee: string }>(
      `select grantee from information_schema.routine_privileges
       where routine_schema = 'public' and routine_name = 'purge_due_accounts' and privilege_type = 'EXECUTE'`,
    );
    expect(rows.map((r) => r.grantee).filter((g) => g !== "postgres")).toEqual(["service_role"]);
  });
});
