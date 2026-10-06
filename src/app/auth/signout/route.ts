import { NextResponse, type NextRequest } from "next/server";
import { endFakeSession, getFakeAccount } from "@/lib/supabase/fake-session";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (await getFakeAccount()) await endFakeSession();
  else await (await createClient()).auth.signOut();
  // 303 so the browser follows the POST with a GET.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
