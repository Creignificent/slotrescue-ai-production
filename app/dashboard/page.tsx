const rows = [
  ["Today's Appointments", "/dashboard/appointments"],
  ["Open Cancellations", "/dashboard/appointments"],
  ["Customer Waitlist", "/dashboard/waitlist"],
  ["AI Recommendations", "/dashboard/campaigns"],
  ["Approval Center", "/dashboard/campaigns"],
  ["Recovered Bookings", "/dashboard/appointments"],
  ["Revenue Dashboard", "/dashboard/business"]
];
export default function Dashboard() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>
      <p style={{ color: "#9c978e", letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 12 }}>Creignificent LLC</p>
      <h1>Business command center</h1>
      <a href="/dashboard/campaigns" style={gold}>FIND A REPLACEMENT CUSTOMER</a>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <tbody>
          {rows.map(([name, href]) => (
            <tr key={name}><td style={td}><a href={href} style={{ color: "#f4f1ea" }}>{name}</a></td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
const gold = { display: "block", background: "#e0b15a", color: "#1a1408", textAlign: "center" as const, padding: 14, borderRadius: 14, textDecoration: "none", fontWeight: 700 };
const td = { padding: "16px 0", borderBottom: "1px solid rgba(244,241,234,.1)" };
