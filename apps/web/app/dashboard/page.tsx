"use client";

import { DragEvent, useMemo, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "kernel.app";
type PublishState = "idle" | "publishing" | "success" | "error";
type WebsiteFile = File & { webkitRelativePath?: string };

function isWebsiteFile(file: File) { return /\.(html?|css|js|mjs|json|txt|xml|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|map)$/i.test(file.name); }
function filePath(file: WebsiteFile) { return file.webkitRelativePath || file.name; }

export default function Dashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<WebsiteFile[]>([]);
  const [domain, setDomain] = useState(""); const [name, setName] = useState("");
  const [progress, setProgress] = useState(0); const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<PublishState>("idle"); const [error, setError] = useState(""); const [liveUrl, setLiveUrl] = useState("");
  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  function addFiles(incoming: FileList | File[]) {
    const next = Array.from(incoming).filter(isWebsiteFile) as WebsiteFile[];
    setFiles((current) => { const seen = new Set(current.map((f) => `${filePath(f)}:${f.size}:${f.lastModified}`)); return [...current, ...next.filter((f) => !seen.has(`${filePath(f)}:${f.size}:${f.lastModified}`))]; });
    setState("idle"); setError("");
  }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }
  function normalizedDomain() {
    let value = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!value) value = `${name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "site"}.${BASE_DOMAIN}`;
    if (!value.includes(".")) value = `${value}.${BASE_DOMAIN}`;
    return value;
  }
  async function publish() {
    if (!files.length) return setError("Drop your website files first.");
    if (!files.some((file) => filePath(file).toLowerCase().split("/").at(-1) === "index.html")) return setError("Your website needs an index.html file.");
    const token = localStorage.getItem("token"); if (!token) return setError("Please log in before publishing.");
    setState("publishing"); setError(""); setLiveUrl(""); setProgress(3);
    const form = new FormData(); form.append("name", name.trim() || "Website"); form.append("domain", normalizedDomain()); form.append("filePaths", JSON.stringify(files.map(filePath)));
    for (const file of files) form.append("files", file, file.name);
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      timer = setInterval(() => setProgress((current) => Math.min(current + Math.max(1, Math.round((90 - current) / 8)), 90)), 180);
      const response = await fetch(`${API}/publish`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Publishing failed");
      setProgress(100); setLiveUrl(data.url); setState("success");
    } catch (err) { setState("error"); setError(err instanceof Error ? err.message : "Publishing failed"); }
    finally { if (timer) clearInterval(timer); }
  }

  return <main className="publisher">
    <div className="topbar"><div className="brand"><span className="logo">K</span><span>Kernel</span><span className="muted">Web Publisher</span></div></div>
    <section className="hero"><p className="eyebrow">STATIC WEBSITE HOSTING</p><h1>Publish your website.</h1><p className="subtitle">Drop your web files, choose a domain, and publish it to the web.</p></section>
    <section className="card">
      <label className="label">Website name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Website" />
      <label className="label domain-label">Domain</label><input className="input" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={`my-site.${BASE_DOMAIN}`} /><p className="hint">Use a subdomain of {BASE_DOMAIN}.</p>
      <label className="label files-label">Website files</label>
      <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}>
        <div className="upload-icon">↑</div><strong>Drag & drop your website here</strong><span>or click to choose files</span><small>HTML, CSS, JS, images, fonts and other static assets · 50 MB max</small><input ref={inputRef} hidden type="file" multiple onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </div>
      {files.length > 0 && <div className="file-list"><div className="file-header"><strong>{files.length} files selected</strong><span>{(totalSize / 1024 / 1024).toFixed(2)} MB</span></div>{files.slice(0, 8).map((file) => <div className="file" key={`${filePath(file)}-${file.size}-${file.lastModified}`}><span>📄</span><span className="file-name">{filePath(file)}</span><span className="file-size">{(file.size / 1024).toFixed(0)} KB</span></div>)}{files.length > 8 && <div className="more">+ {files.length - 8} more files</div>}</div>}
      {state === "publishing" && <div className="progress-wrap"><div className="progress-line"><strong>Publishing website...</strong><span>{progress}%</span></div><div className="progress"><div className="progress-bar" style={{ width: `${progress}%` }} /></div><p className="hint">Uploading files and creating your live deployment.</p></div>}
      {error && <div className="error">{error}</div>}
      {state === "success" && <div className="success"><div className="check">✓</div><div><strong>Website published!</strong><p>Your site is live at <a href={liveUrl} target="_blank" rel="noreferrer">{liveUrl}</a></p></div></div>}
      <button className="publish" disabled={state === "publishing" || !files.length} onClick={publish}>{state === "publishing" ? `Publishing ${progress}%` : state === "success" ? "Publish New Version" : "🚀 Publish Website"}</button>
    </section>
    <footer>Kernel Web Publisher · Static sites only · You are responsible for content you publish.</footer>
    <style jsx>{`.publisher{min-height:100vh;background:#f6f7f9;color:#111827;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}.topbar{height:64px;border-bottom:1px solid #e5e7eb;background:white;display:flex;align-items:center;padding:0 28px}.brand{display:flex;align-items:center;gap:9px;font-weight:700;letter-spacing:-.02em}.muted{color:#9ca3af;font-weight:500}.logo{width:30px;height:30px;border-radius:8px;background:#111827;color:white;display:grid;place-items:center}.hero{text-align:center;max-width:720px;margin:0 auto;padding:72px 24px 36px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.16em;color:#6b7280}.hero h1{font-size:48px;line-height:1.05;letter-spacing:-.045em;margin:12px 0}.subtitle{color:#6b7280;font-size:18px}.card{max-width:760px;margin:0 auto 60px;background:white;border:1px solid #e5e7eb;border-radius:20px;padding:28px;box-shadow:0 10px 35px rgba(17,24,39,.06)}.label{display:block;font-size:13px;font-weight:700;margin:0 0 8px}.domain-label,.files-label{margin-top:22px}.input{box-sizing:border-box;width:100%;border:1px solid #d1d5db;border-radius:10px;padding:13px 14px;font-size:15px;outline:none;background:white}.input:focus{border-color:#111827;box-shadow:0 0 0 3px #e5e7eb}.hint{margin:7px 0 0;color:#9ca3af;font-size:12px}.dropzone{margin-top:10px;min-height:210px;border:2px dashed #d1d5db;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:.15s}.dropzone:hover,.dropzone.dragging{border-color:#111827;background:#fafafa}.upload-icon{width:46px;height:46px;border-radius:12px;background:#f3f4f6;display:grid;place-items:center;font-size:24px;margin-bottom:14px}.dropzone strong{font-size:16px}.dropzone span{color:#6b7280;margin-top:5px;font-size:14px}.dropzone small{color:#9ca3af;margin-top:14px;font-size:11px}.file-list{margin-top:14px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}.file-header,.file{display:grid;grid-template-columns:1fr auto;gap:10px;padding:10px 13px;font-size:13px;border-bottom:1px solid #f3f4f6}.file-header{background:#fafafa}.file{grid-template-columns:auto 1fr auto}.file-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-size{color:#9ca3af}.more{padding:10px 13px;color:#6b7280;font-size:12px}.progress-wrap{margin-top:20px}.progress-line{display:flex;justify-content:space-between;font-size:13px}.progress{height:10px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin-top:9px}.progress-bar{height:100%;background:#111827;border-radius:99px;transition:width .18s ease}.error{margin-top:16px;padding:12px 14px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:13px}.success{display:flex;gap:12px;margin-top:18px;padding:14px;border-radius:12px;background:#f0fdf4;color:#166534}.success p{margin:3px 0 0;font-size:13px}.success a{color:inherit;font-weight:700}.check{width:28px;height:28px;border-radius:50%;background:#16a34a;color:white;display:grid;place-items:center;flex:none}.publish{width:100%;margin-top:22px;border:0;border-radius:11px;padding:14px;background:#111827;color:white;font-size:15px;font-weight:750;cursor:pointer}.publish:hover:not(:disabled){background:#000}.publish:disabled{opacity:.45;cursor:not-allowed}footer{text-align:center;color:#9ca3af;font-size:11px;padding:0 20px 40px}@media(max-width:600px){.hero{padding-top:48px}.hero h1{font-size:38px}.card{margin:0 14px 40px;padding:20px}.topbar{padding:0 16px}.muted{display:none}}`}</style>
  </main>;
}
