import { draftOffer } from "@/lib/gemini";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.shop || !body?.service || !body?.when) return NextResponse.json({ error: "shop, service, when required" }, { status: 400 });
  const draft = await draftOffer({
    shop: body.shop,
    service: body.service,
    when: body.when,
    staff: body.staff || "staff",
    priceCents: Number(body.priceCents || 0),
    reason: body.reason || "opted in for this service"
  });
  return NextResponse.json(draft);
}
