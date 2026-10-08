import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !key || !signature) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), signature, secret); }
  catch { return NextResponse.json({ error: "Invalid signature." }, { status: 400 }); }
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminUrl || !service) return NextResponse.json({ received: true, stored: false });
  const admin = createClient(adminUrl, service, { auth: { persistSession: false } });
  if (event.type === "checkout.session.completed" || event.type === "customer.subscription.updated") {
    const obj = event.data.object as { metadata?: { business_id?: string }; customer?: string; subscription?: string; status?: string };
    const businessId = obj.metadata?.business_id;
    if (businessId) await admin.from("subscriptions").upsert({ business_id: businessId, plan: "pro", stripe_customer_id: obj.customer || null, stripe_subscription_id: obj.subscription || null, status: obj.status || "active" }, { onConflict: "business_id" });
  }
  if (event.type === "customer.subscription.deleted") {
    const obj = event.data.object as { metadata?: { business_id?: string } };
    if (obj.metadata?.business_id) await admin.from("subscriptions").update({ plan: "free", status: "canceled" }).eq("business_id", obj.metadata.business_id);
  }
  return NextResponse.json({ received: true });
}
