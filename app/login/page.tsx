"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return setMsg("Supabase is not configured.");
    const supabase = createBrowserClient(url, anon);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);
    window.location.href = "/dashboard";
  }
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>
      <h1>Owner login</h1>
      <form onSubmit={signIn}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={field} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" style={field} />
        <button style={btn}>Sign in</button>
      </form>
      {msg && <p>{msg}</p>}
    </main>
  );
}
const field: CSSProperties = { width: "100%", margin: "8px 0", padding: 12, background: "#0c0e12", color: "#f4f1ea", border: "1px solid #333", borderRadius: 12 };
const btn: CSSProperties = { width: "100%", padding: 14, background: "#e0b15a", color: "#1a1408", border: 0, borderRadius: 12 };
