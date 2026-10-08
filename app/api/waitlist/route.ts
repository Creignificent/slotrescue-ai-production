import { requireMember } from "@/lib/auth";
import { json, missing } from "@/lib/http";

export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get("businessId");
  if (!businessId) return missing("businessId");
  const gate = await requireMember(req, businessId);
  if ("error" in gate) return json({ error: gate.error }, gate.status);
  const { data, error } = await gate.supabase
    .from("waitlist_entries")
    .select("id, name, email, service_interest, time_window, priority, active")
    .eq("business_id", businessId);
  if (error) return json({ error: error.message }, 400);
  return json({ waitlist: data });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.businessId || !body.name || !body.email || !body.serviceInterest) {
    return missing("businessId, name, email, serviceInterest");
  }
  if (!String(body.email).includes("@")) return json({ error: "Email is invalid." }, 400);
  const gate = await requireMember(req, body.businessId);
  if ("error" in gate) return json({ error: gate.error }, gate.status);
  const { data, error } = await gate.supabase
    .from("waitlist_entries")
    .insert({
      business_id: body.businessId,
      name: body.name,
      email: body.email,
      service_interest: body.serviceInterest,
      time_window: body.timeWindow || "Anytime",
      priority: Number(body.priority || 1),
      active: true
    })
    .select("id")
    .single();
  if (error) return json({ error: error.message }, 400);
  const consent = await gate.supabase.from("consent_records").insert({
    business_id: body.businessId,
    waitlist_id: data.id,
    channel: "email"
  });
  if (consent.error) return json({ error: consent.error.message }, 400);
  return json({ waitlistId: data.id, consent: "email" }, 201);
}
