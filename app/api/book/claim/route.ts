import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/ratelimit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.token || !body.waitlistId) return NextResponse.json({ error: "token and waitlistId required" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for") || "local";
  const limit = rateLimit(`claim:${body.token}:${ip}`, 5, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many claim attempts." }, { status: 429 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Booking database is not configured." }, { status: 503 });
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("claim_booking", { p_token: body.token, p_waitlist_id: body.waitlistId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
