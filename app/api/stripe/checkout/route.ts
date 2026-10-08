import { requireMember } from "@/lib/auth";
import { json, missing } from "@/lib/http";
import { stripeClient } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.businessId) return missing("businessId");
  const gate = await requireMember(req, body.businessId);
  if ("error" in gate) return json({ error: gate.error }, gate.status);
  if (gate.role !== "owner") return json({ error: "Owner required." }, 403);
  const price = process.env.STRIPE_PRICE_PRO;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!price || !appUrl) return json({ error: "Stripe price or app URL is not set." }, 500);
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl}/?billing=success`,
    cancel_url: `${appUrl}/?billing=cancel`,
    metadata: { business_id: body.businessId }
  });
  return json({ url: session.url });
}
