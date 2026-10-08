import { Resend } from "resend";
import { requireMember } from "@/lib/auth";
import { json, missing } from "@/lib/http";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.businessId || !body.appointmentId || !body.offerBody || !Array.isArray(body.waitlistIds)) {
    return missing("businessId, appointmentId, offerBody, waitlistIds");
  }
  const gate = await requireMember(req, body.businessId);
  if ("error" in gate) return json({ error: gate.error }, gate.status);
  const { data, error } = await gate.supabase
    .from("recovery_campaigns")
    .insert({
      business_id: body.businessId,
      appointment_id: body.appointmentId,
      status: "draft",
      offer_body: body.offerBody
    })
    .select("id, claim_token, status")
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ campaign: data, recipients: body.waitlistIds }, 201);
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.businessId || !body.campaignId) return missing("businessId, campaignId");
  const gate = await requireMember(req, body.businessId);
  if ("error" in gate) return json({ error: gate.error }, gate.status);
  if (gate.role !== "owner") return json({ error: "Owner approval required." }, 403);

  const business = await gate.supabase
    .from("businesses")
    .select("automation_enabled")
    .eq("id", body.businessId)
    .single();
  if (!business.data?.automation_enabled) return json({ error: "Automation is off." }, 409);

  const campaign = await gate.supabase
    .from("recovery_campaigns")
    .update({ status: "sent", approved_at: new Date().toISOString() })
    .eq("id", body.campaignId)
    .eq("business_id", body.businessId)
    .eq("status", "draft")
    .select("id, offer_body, claim_token")
    .single();
  if (campaign.error || !campaign.data) return json({ error: "Draft campaign not found." }, 404);

  const ids = Array.isArray(body.waitlistIds) ? body.waitlistIds : [];
  const recipients = await gate.supabase
    .from("waitlist_entries")
    .select("id, email, name")
    .eq("business_id", body.businessId)
    .in("id", ids);
  if (recipients.error) return json({ error: recipients.error.message }, 400);

  const from = process.env.RESEND_FROM;
  const key = process.env.RESEND_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const resend = key ? new Resend(key) : null;
  const deliveries = [];
  for (const person of recipients.data || []) {
    let status = "skipped-no-resend";
    if (resend && from) {
      const sent = await resend.emails.send({
        from,
        to: person.email,
        subject: "An opening is available",
        text: `${campaign.data.offer_body}\n\nReserve: ${appUrl}/book/${campaign.data.claim_token}`
      });
      status = sent.error ? "failed" : "sent";
    }
    deliveries.push({ waitlistId: person.id, status });
    await gate.supabase.from("notification_deliveries").insert({
      business_id: body.businessId,
      campaign_id: campaign.data.id,
      waitlist_id: person.id,
      channel: "email",
      status
    });
  }
  await gate.supabase.from("audit_events").insert({
    business_id: body.businessId,
    action: "approve",
    detail: `Owner approved campaign ${campaign.data.id}`
  });
  return json({ campaignId: campaign.data.id, deliveries });
}
