export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>
      <p style={{ letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 12, color: "#9c978e" }}>Creignificent LLC</p>
      <h1 style={{ fontSize: 40, lineHeight: 0.95 }}>Canceled time is still sellable.</h1>
      <p style={{ color: "#9c978e" }}>SlotRescue fills an opted-in waitlist spot after the owner approves the offer. The first valid claim wins.</p>
      <a href="/login" style={{ color: "#e0b15a" }}>Owner login</a>
      <p style={{ color: "#9c978e", fontSize: 13 }}>No demo login is shipped. Create the owner in Supabase Auth, then sign in.</p>
    </main>
  );
}
