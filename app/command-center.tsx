"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Appt = { id: string; customer: string; service: string; staff: string; time: string; price: number; status: string; canceledFrom?: string; recoveredBy?: string };
type Person = { id: string; name: string; email: string; service: string; window: string; priority: number; consent: boolean };
type Book = {
  shop: string; city: string; plan: string; automation: boolean;
  appointments: Appt[]; waitlist: Person[];
  campaigns: { id: string; appointmentId: string; status: string; body: string; recipients: string[] }[];
  reservations: { id: string; appointmentId: string; customerId: string; status: string }[];
  revenue: { id: string; amount: number; note: string }[];
  audit: { at: string; action: string; detail: string }[];
};

const KEY = "slotrescue.v1";
const sample = (): Book => ({
  shop: "Harbor Fade", city: "Rialto", plan: "free", automation: true,
  appointments: [
    { id: "a1", customer: "Jordan Lee", service: "Skin fade", staff: "Marcus", time: "11:00", price: 45, status: "scheduled" },
    { id: "a2", customer: "Chris Patel", service: "Beard trim", staff: "Dre", time: "12:30", price: 25, status: "scheduled" },
    { id: "a3", customer: "Andre Cole", service: "Cut + beard", staff: "Marcus", time: "14:30", price: 75, status: "open", canceledFrom: "Andre Cole" },
    { id: "a4", customer: "Maya Brooks", service: "Skin fade", staff: "Dre", time: "16:00", price: 45, status: "recovered", recoveredBy: "Maya Brooks" }
  ],
  waitlist: [
    { id: "w1", name: "Maya Brooks", email: "maya@example.com", service: "Skin fade", window: "Afternoon", priority: 2, consent: true },
    { id: "w2", name: "Luis Ortega", email: "luis@example.com", service: "Cut + beard", window: "Afternoon", priority: 3, consent: true },
    { id: "w3", name: "Sam Nguyen", email: "sam@example.com", service: "Cut + beard", window: "Morning", priority: 1, consent: true },
    { id: "w4", name: "Imani Ross", email: "imani@example.com", service: "Beard trim", window: "Anytime", priority: 1, consent: false }
  ],
  campaigns: [],
  reservations: [{ id: "r0", appointmentId: "a4", customerId: "w1", status: "confirmed" }],
  revenue: [{ id: "rev0", amount: 45, note: "Recovered 4:00 skin fade" }],
  audit: [{ at: "09:12", action: "seed", detail: "Sample Harbor Fade book. Not live customers." }]
});

function load(): Book {
  if (typeof window === "undefined") return sample();
  try { return JSON.parse(localStorage.getItem(KEY) || "") as Book; } catch { return sample(); }
}
function clock() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

export default function CommandCenter() {
  const [book, setBook] = useState<Book>(sample);
  const [screen, setScreen] = useState("land");
  const [step, setStep] = useState(1);
  const [apptId, setApptId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [offer, setOffer] = useState("");
  const [campId, setCampId] = useState("");
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => { setBook(load()); setReady(true); }, []);
  function save(next: Book) { localStorage.setItem(KEY, JSON.stringify(next)); setBook(next); }
  function ping(msg: string) { setToast(msg); setTimeout(() => setToast(""), 2200); }

  const open = book.appointments.filter((a) => a.status === "open");
  const recovered = book.revenue.reduce((n, r) => n + r.amount, 0);
  const rows = [
    ["Today's Appointments", "Displays all scheduled appointments for today", "appts"],
    ["Open Cancellations", "Shows available openings from canceled appointments", "open"],
    ["Customer Waitlist", "Lists customers opted into replacement offers", "waitlist"],
    ["AI Recommendations", "Suggests consented customers who fit the open slot", "recs"],
    ["Approval Center", "Reviews the offer and recipients before send", "approve"],
    ["Recovered Bookings", "Shows appointments filled from the waitlist", "recovered"],
    ["Revenue Dashboard", "Tracks recovered sales from filled openings", "revenue"]
  ];

  function cancel(id: string) {
    const next = structuredClone(book);
    const a = next.appointments.find((x) => x.id === id);
    if (!a) return;
    a.canceledFrom = a.customer; a.customer = ""; a.status = "open";
    next.audit.unshift({ at: clock(), action: "cancel", detail: `${a.time} ${a.service} marked canceled.` });
    save(next); ping("Opening created.");
  }
  function matches(a: Appt) {
    return book.waitlist.map((w) => {
      if (!w.consent || w.service !== a.service) return null;
      let score = 50 + w.priority * 10;
      const afternoon = a.time >= "12:00";
      if (w.window === "Anytime") score += 15;
      else if (afternoon && w.window === "Afternoon") score += 25;
      else if (!afternoon && w.window === "Morning") score += 25;
      else score -= 10;
      return { w, score };
    }).filter((x): x is { w: Person; score: number } => !!x).sort((a, b) => b.score - a.score);
  }
  function approve() {
    if (!book.automation) return ping("Automation is off.");
    const next = structuredClone(book);
    const a = next.appointments.find((x) => x.id === apptId);
    if (!a) return;
    if (offer.includes("$") && !offer.includes(String(a.price))) return ping("Price must match the appointment.");
    const id = "c" + Date.now();
    next.campaigns.push({ id, appointmentId: a.id, status: "sent", body: offer, recipients: picked });
    next.audit.unshift({ at: clock(), action: "approve", detail: `Owner approved ${a.time} ${a.service}.` });
    save(next); setCampId(id); setStep(4); ping("Approved. Customer link is open.");
  }
  function claim(customerId: string) {
    const next = structuredClone(book);
    const camp = next.campaigns.find((c) => c.id === campId);
    const a = next.appointments.find((x) => x.id === camp?.appointmentId);
    const person = next.waitlist.find((w) => w.id === customerId);
    if (!camp || !a || !person?.consent) return ping("No consent on file.");
    if (a.status !== "open" || next.reservations.some((r) => r.appointmentId === a.id && r.status === "confirmed")) {
      next.reservations.push({ id: "rx" + Date.now(), appointmentId: a.id, customerId, status: "rejected" });
      next.audit.unshift({ at: clock(), action: "reject", detail: `${person.name} lost the race.` });
      save(next); return ping("Opening already taken.");
    }
    a.status = "recovered"; a.customer = person.name; a.recoveredBy = person.name; camp.status = "filled";
    next.reservations.push({ id: "r" + Date.now(), appointmentId: a.id, customerId, status: "confirmed" });
    next.revenue.push({ id: "rev" + Date.now(), amount: a.price, note: `Recovered ${a.time} ${a.service}` });
    next.audit.unshift({ at: clock(), action: "confirm", detail: `${person.name} confirmed ${a.time}. Others blocked.` });
    save(next); ping("Booked. Competing claims fail.");
  }

  if (!ready) return null;
  const appt = book.appointments.find((a) => a.id === apptId);
  const camp = book.campaigns.find((c) => c.id === campId);

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22 }}>Slot<span style={{ color: "#e0b15a" }}>Rescue</span></div>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9c978e" }}>Creignificent LLC</div>
        </div>
        <div style={{ border: "1px solid rgba(244,241,234,.1)", borderRadius: 999, padding: "6px 10px", fontSize: 12, color: book.automation ? "#3dbe8c" : "#e15d4e" }}>{book.automation ? "Automation live" : "Automation off"}</div>
      </div>

      {screen === "land" && (
        <section>
          <h1 style={h1}>Canceled time is still sellable.</h1>
          <p style={lede}>Find an opted-in customer, approve the offer, and let the first valid claim take the slot.</p>
          <button style={btn} onClick={() => setScreen("home")}>Open the command center</button>
          <div style={card}><b>Harbor Fade · Rialto</b><p style={meta}>Working deployed book for this browser. Sample customers, real booking lock.</p></div>
        </section>
      )}

      {screen === "home" && (
        <section>
          <h2 style={h2}>Business command center</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Dashboard component</th><th style={th}>Function</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[2]} onClick={() => setScreen(r[2] === "recs" || r[2] === "approve" ? "rescue" : r[2] === "revenue" ? "revenue" : r[2])}>
                  <td style={td}>{r[0]}</td><td style={{ ...td, color: "#9c978e", fontSize: 14 }}>{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button style={btn} onClick={() => { setStep(1); setScreen("rescue"); }}>FIND A REPLACEMENT CUSTOMER</button>
        </section>
      )}

      {["appts", "open", "waitlist", "recovered"].includes(screen) && (
        <section>
          <h2 style={h2}>{screen === "appts" ? "Today's appointments" : screen === "open" ? "Open cancellations" : screen === "waitlist" ? "Customer waitlist" : "Recovered bookings"}</h2>
          {screen !== "waitlist" && book.appointments.filter((a) => screen === "appts" || (screen === "open" && a.status === "open") || (screen === "recovered" && a.status === "recovered")).map((a) => (
            <div key={a.id} style={card}>
              <b>{a.time} · {a.service}</b>
              <p style={meta}>{a.staff} · ${a.price} · {a.status}{a.canceledFrom ? ` · canceled by ${a.canceledFrom}` : ""}</p>
              {screen === "appts" && a.status === "scheduled" && <button style={ghost} onClick={() => cancel(a.id)}>Mark canceled</button>}
            </div>
          ))}
          {screen === "waitlist" && book.waitlist.map((w) => (
            <div key={w.id} style={card}><b>{w.name}</b><p style={meta}>{w.consent ? "Opted in" : "No consent"} · {w.service} · {w.window}</p></div>
          ))}
        </section>
      )}

      {screen === "rescue" && (
        <section>
          <h2 style={h2}>Find a replacement</h2>
          {step === 1 && open.map((a) => (
            <div key={a.id} style={card}><b>{a.time} · {a.service}</b><p style={meta}>{a.staff} · ${a.price}</p><button style={btn} onClick={() => { setApptId(a.id); setStep(2); }}>Use this opening</button></div>
          ))}
          {step === 2 && appt && matches(appt).map((m) => (
            <label key={m.w.id} style={{ display: "flex", gap: 8, padding: "10px 0" }}>
              <input type="checkbox" checked={picked.includes(m.w.id)} onChange={() => setPicked(picked.includes(m.w.id) ? picked.filter((id) => id !== m.w.id) : picked.concat(m.w.id))} />
              <span>{m.w.name} · score {m.score}<br /><span style={meta}>{m.w.window}</span></span>
            </label>
          ))}
          {step === 2 && <button style={btn} onClick={() => { if (!picked.length) return ping("Select a customer."); setOffer(`Harbor Fade has an opening.\n\n${appt?.time} · ${appt?.service} · ${appt?.staff}\n${appt?.price} dollars.\n\nFirst confirmed request takes the slot. Pay at the shop.`); setStep(3); }}>Draft the offer</button>}
          {step === 3 && <><textarea value={offer} onChange={(e) => setOffer(e.target.value)} style={{ width: "100%", minHeight: 140, background: "#0c0e12", color: "#f4f1ea", borderRadius: 12, padding: 12 }} /><button style={btn} onClick={approve}>Approve recipients and offer</button></>}
          {step === 4 && camp && (
            <div style={card}>
              <b>{camp.status}</b>
              <p style={{ whiteSpace: "pre-wrap" }}>{camp.body}</p>
              {book.waitlist.filter((w) => camp.recipients.includes(w.id)).map((w) => <button key={w.id} style={btn} onClick={() => claim(w.id)}>Reserve as {w.name}</button>)}
            </div>
          )}
        </section>
      )}

      {screen === "revenue" && (
        <section>
          <h2 style={h2}>Revenue dashboard</h2>
          <div style={card}><b>${recovered}</b><p style={meta}>Recovered sales in this book</p></div>
          {book.revenue.map((r) => <div key={r.id} style={card}>${r.amount} · {r.note}</div>)}
          <div style={card}><b>Pro · $29/month</b><p style={meta}>Stripe Checkout activates after STRIPE_PRICE_PRO is set in Vercel. Service payment stays with the shop.</p></div>
        </section>
      )}

      {screen === "settings" && (
        <section>
          <h2 style={h2}>Settings</h2>
          <button style={ghost} onClick={() => { const next = structuredClone(book); next.automation = !next.automation; next.audit.unshift({ at: clock(), action: next.automation ? "enable" : "kill", detail: next.automation ? "Automation on." : "Shutdown." }); save(next); }}> {book.automation ? "Disable automation" : "Enable automation"}</button>
          <button style={ghost} onClick={() => { localStorage.removeItem(KEY); save(sample()); ping("Sample book restored."); }}>Restore sample book</button>
          {book.audit.slice(0, 8).map((e, i) => <p key={i} style={meta}>{e.at} · {e.action} · {e.detail}</p>)}
        </section>
      )}

      {toast && <div style={{ position: "fixed", left: 16, right: 16, bottom: 78, background: "#1c2118", borderRadius: 12, padding: 12 }}>{toast}</div>}
      <nav style={nav}>
        {[["home", "Home"], ["rescue", "Rescue"], ["waitlist", "Waitlist"], ["revenue", "Revenue"], ["settings", "Settings"]].map(([id, label]) => (
          <button key={id} style={{ background: "none", border: 0, color: screen === id ? "#f0d7a2" : "#9c978e" }} onClick={() => { if (id === "rescue") setStep(1); setScreen(id); }}>{label}</button>
        ))}
      </nav>
    </div>
  );
}

const wrap: CSSProperties = { maxWidth: 480, margin: "0 auto", padding: "18px 16px 108px", background: "#07080a", color: "#f4f1ea", minHeight: "100dvh", fontFamily: "Georgia, sans-serif" };
const h1: CSSProperties = { fontSize: 40, lineHeight: 0.95, margin: "22px 0 10px" };
const h2: CSSProperties = { fontSize: 28, margin: "8px 0" };
const lede: CSSProperties = { color: "#9c978e", lineHeight: 1.45 };
const btn: CSSProperties = { width: "100%", border: 0, borderRadius: 14, padding: 15, background: "#e0b15a", color: "#1a1408", fontWeight: 600, marginTop: 8 };
const ghost: CSSProperties = { ...btn, background: "transparent", color: "#f4f1ea", border: "1px solid rgba(244,241,234,.1)" };
const card: CSSProperties = { background: "#12141a", border: "1px solid rgba(244,241,234,.1)", borderRadius: 16, padding: 14, margin: "10px 0" };
const meta: CSSProperties = { color: "#9c978e", fontSize: 13 };
const td: CSSProperties = { padding: "16px 8px 16px 0", borderBottom: "1px solid rgba(244,241,234,.1)", verticalAlign: "top" };
const th: CSSProperties = { textAlign: "left", color: "#9c978e", fontSize: 13, padding: "8px 0" };
const nav: CSSProperties = { position: "fixed", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-around", background: "rgba(7,8,10,.94)", padding: 10 };
