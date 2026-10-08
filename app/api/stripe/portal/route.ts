import { requireMember } from "@/lib/auth";
import { json, missing } from "@/lib/http";
import { stripeClient } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.businessId) return missing("businessId");
  const gate = await requireMember(req, body.businessId);
  if ("error" in gate) return json({ error: gate.error }, gate.status);
  if (gate.role !== "owner") return json({ error: "Owner required." }, 403);
  const sub = await gate.supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("business_id", body.businessId)
    .maybeSingle();
  if (!sub.data?.stripe_customer_id) return json({ error: "No Stripe customer on this business." }, 404);
  const stripe = stripeClient();
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.data.stripe_customer_id,
    return_url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  });
  return json({ url: portal.url });
}
