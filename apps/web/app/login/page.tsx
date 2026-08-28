"use client";
import { FormEvent, useState } from "react";

const API = "/api/kernel";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "include"
      });
      const text = await r.text();
      let d: { error?: string; token?: string } = {};
      try { d = JSON.parse(text); } catch {}
      if (!r.ok) throw new Error(d.error || `Login failed (${r.status})`);
      if (!d.token) throw new Error("The API did not return a login token.");
      localStorage.setItem("token", d.token);
      window.location.href = "/dashboard";
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to connect to Kernel API");
    } finally { setLoading(false); }
  }

  return <main className="auth"><form className="auth-card" onSubmit={submit}>
    <img src="/kernel-logo.svg" alt="Kernel"/><h1>Log in</h1>
    <p>Access your Kernel Cloud workspace.</p>
    <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
    {error && <div className="error">{error}</div>}
    <button className="publish" disabled={loading}>{loading ? "Logging in…" : "Log in →"}</button>
    <a className="switch" href="/register">Don't have an account? Create one</a>
  </form></main>;
}
