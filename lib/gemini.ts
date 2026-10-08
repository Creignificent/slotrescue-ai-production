export async function draftOffer(input: { shop: string; service: string; when: string; staff: string; priceCents: number; reason: string }) {
  const grounded = `${input.shop} has an opening.\n\n${input.when} · ${input.service} · ${input.staff}\n${(input.priceCents / 100).toFixed(2)} dollars.\nReason you were selected: ${input.reason}\n\nThe first confirmed request takes the slot. Pay at the shop. Unsubscribe link is included by the sender.`;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { text: grounded, source: "deterministic" as const };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Draft a short appointment recovery email. Use only these facts. Do not invent times, prices, or availability.\n${grounded}` }] }]
    })
  });
  if (!res.ok) return { text: grounded, source: "deterministic" as const };
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { text: typeof text === "string" && text.trim() ? text : grounded, source: text ? "gemini" as const : "deterministic" as const };
}
