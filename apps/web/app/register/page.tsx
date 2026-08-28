"use client";
import { FormEvent, useState } from "react";

const API = "/api/kernel";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
        credentials: "include"
      });
      const text = await r.text();
      let d: { error?: string; token?: string } = {};
      try { d = JSON.parse(text); } catch {}
      if (!r.ok) throw new Error(d.error || `Registration failed (${r.status})`);
      if (!d.token) throw new Error("The API did not return an account token.");
      localStorage.setItem("token", d.token);
      window.location.href = "/dashboard";
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to connect to Kernel API");
    } finally { setLoading(false); }
  }

  return <main className="auth"><form className="auth-card" onSubmit={submit}>
    <img src="/kernel-logo.svg" alt="Kernel"/><h1>Create account</h1>
    <p>Create a password-protected Kernel Cloud workspace.</p>
    <label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name"/></label>
    <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete="new-password"/></label>
    {error && <div className="error">{error}</div>}
    <button className="publish" disabled={loading}>{loading ? "Creating account…" : "Create account →"}</button>
    <a className="switch" href="/login">Already have an account? Log in</a>
  </form></main>;
}
