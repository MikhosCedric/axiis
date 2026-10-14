import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));

// The slice of Supabase's platform schema that migrations depend on. auth.uid()
// matches Supabase's definition, which reads the JWT `sub` claim that PostgREST
// sets per request.
const SUPABASE_STUB = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  create role supabase_auth_admin nologin noinherit;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
  grant usage on schema public to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    created_at timestamptz not null default now()
  );
  grant select, insert, update, delete on auth.users to supabase_auth_admin;

  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
`;

export type Tx = Transaction;

export type TestDb = {
  /** Superuser connection: bypasses RLS, like the Supabase SQL editor. */
  admin: PGlite;
  /**
   * Runs one statement as the superuser with user triggers off, so it can backdate
   * created_at and add rows faster than the 0007 rate limits allow.
   */
  seed(sql: string, params?: unknown[]): Promise<void>;
  /** Signs up a user the way Supabase Auth does, as supabase_auth_admin. */
  createUser(): Promise<string>;
  /** Runs `fn` in one transaction as the `authenticated` role with `sub = userId`. */
  asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Runs `fn` in one transaction as the `anon` role with no JWT subject. */
  asAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
};

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(MIGRATIONS_DIR, f));
}

export async function createTestDb(): Promise<TestDb> {
  const admin = await PGlite.create();
  await admin.exec(SUPABASE_STUB);
  for (const file of migrationFiles()) {
    await admin.exec(readFileSync(file, "utf8"));
  }

  const asRole = <T>(role: string, sub: string, fn: (tx: Tx) => Promise<T>) =>
    admin.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
      return fn(tx);
    });

  return {
    admin,
    async seed(sql, params) {
      await admin.transaction(async (tx) => {
        await tx.exec("set local session_replication_role = replica");
        await tx.query(sql, params);
      });
    },
    async createUser() {
      return admin.transaction(async (tx) => {
        await tx.exec("set local role supabase_auth_admin");
        const { rows } = await tx.query<{ id: string }>("insert into auth.users default values returning id");
        return rows[0].id;
      });
    },
    asUser: (userId, fn) => asRole("authenticated", userId, fn),
    asAnon: (fn) => asRole("anon", "", fn),
  };
}
