import { requireMember } from "@/lib/auth";
import { json, missing } from "@/lib/http";

export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get("businessId");
  if (!businessId) return missing("businessId");
  const gate = await requireMember(req, businessId);
  if ("error" in gate) return json({ error: gate.error }, gate.status);
  const { data, error } = await gate.supabase
    .from("appointments")
    .select("id, service_id, staff_name, customer_name, starts_at, status, price_cents")
    .eq("business_id", businessId)
    .order("starts_at");
  if (error) return json({ error: error.message }, 400);
  return json({ appointments: data });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.businessId || !body.serviceId || !body.staffName || !body.startsAt) {
    return missing("businessId, serviceId, staffName, startsAt");
  }
  const gate = await requireMember(req, body.businessId);
  if ("error" in gate) return json({ error: gate.error }, gate.status);
  const { data, error } = await gate.supabase
    .from("appointments")
    .insert({
      business_id: body.businessId,
      service_id: body.serviceId,
      staff_name: body.staffName,
      customer_name: body.customerName || null,
      starts_at: body.startsAt,
      status: body.status || "scheduled",
      price_cents: Number(body.priceCents)
    })
    .select("id, status")
    .single();
  if (error) return json({ error: error.message }, 400);
  await gate.supabase.from("audit_events").insert({
    business_id: body.businessId,
    action: "appointment",
    detail: `Created appointment ${data.id}`
  });
  return json({ appointment: data }, 201);
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.businessId || !body.appointmentId || body.status !== "open") {
    return missing("businessId, appointmentId, status=open");
  }
  const gate = await requireMember(req, body.businessId);
  if ("error" in gate) return json({ error: gate.error }, gate.status);
  const { data, error } = await gate.supabase
    .from("appointments")
    .update({ status: "open", customer_name: null })
    .eq("id", body.appointmentId)
    .eq("business_id", body.businessId)
    .eq("status", "scheduled")
    .select("id, starts_at, price_cents")
    .single();
  if (error) return json({ error: error.message }, 400);
  await gate.supabase.from("audit_events").insert({
    business_id: body.businessId,
    action: "cancel",
    detail: `Marked ${data.id} open for recovery`
  });
  return json({ appointment: data });
}
