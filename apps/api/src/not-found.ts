export function kernelNotFoundPage(
  title = "This page does not exist"
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - Kernel Cloud</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      min-height: 100vh;
      overflow: hidden;
      background: radial-gradient(circle at 50% 25%, rgba(124,58,237,.22), transparent 35%), #08050d;
      color: #fff;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .page { min-height: 100vh; display: grid; place-items: center; padding: 30px; position: relative; }
    .background { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
    .glow { position: absolute; width: 500px; height: 500px; left: 50%; top: 50%; transform: translate(-50%,-50%); background: rgba(139,92,246,.12); filter: blur(100px); border-radius: 50%; }
    .card {
      position: relative;
      width: min(680px,100%);
      text-align: center;
      padding: 52px 32px;
      border: 1px solid #342044;
      border-radius: 24px;
      background: rgba(18,10,27,.88);
      box-shadow: 0 30px 100px rgba(0,0,0,.55), 0 0 80px rgba(124,58,237,.08);
      backdrop-filter: blur(18px);
    }
    .logo { width: 42px; height: 42px; margin-bottom: 28px; }
    .cloud { width: 220px; height: 130px; margin: 0 auto 28px; position: relative; }
    .cloud-shape {
      position: absolute; left: 18px; right: 18px; bottom: 12px; height: 66px;
      border-radius: 60px;
      background: linear-gradient(135deg,#ff4057,#a855f7 48%,#3b82f6);
      box-shadow: 0 15px 50px rgba(168,85,247,.25);
    }
    .cloud-shape::before { content:""; position:absolute; width:76px; height:76px; left:36px; bottom:24px; border-radius:50%; background:#a855f7; }
    .cloud-shape::after { content:""; position:absolute; width:92px; height:92px; right:34px; bottom:19px; border-radius:50%; background:#6d5ce7; }
    .error-x {
      position:absolute; z-index:5; width:48px; height:48px; left:50%; top:38px; transform:translateX(-50%);
      display:grid; place-items:center; border-radius:50%; background:#ef3340; border:5px solid #120a1a;
      color:#fff; font-size:28px; font-weight:900; box-shadow:0 8px 30px rgba(239,51,64,.4);
    }
    .eyebrow { margin:0 0 12px; color:#b875ff; font-size:10px; font-weight:900; letter-spacing:.2em; text-transform:uppercase; }
    h1 { margin:0; font-size:clamp(32px,6vw,52px); line-height:1.05; letter-spacing:-.05em; }
    .typewriter {
      display:inline-block; max-width:100%; overflow:hidden; white-space:nowrap;
      border-right:3px solid #b875ff;
      animation:typing 3s steps(31,end), cursor .7s step-end infinite;
      background:linear-gradient(90deg,#fff,#c084fc,#fff);
      -webkit-background-clip:text; background-clip:text; color:transparent;
    }
    @keyframes typing { from { width:0; } to { width:100%; } }
    @keyframes cursor { 50% { border-color:transparent; } }
    .description { max-width:520px; margin:22px auto 0; color:#9f91ad; font-size:14px; line-height:1.7; }
    .owner { margin-top:25px; color:#d8cbe2; font-size:12px; font-weight:700; letter-spacing:.08em; }
    .owner span { color:#b875ff; }
    .buttons { display:flex; justify-content:center; gap:10px; margin-top:30px; flex-wrap:wrap; }
    .button {
      display:inline-flex; align-items:center; justify-content:center; padding:11px 18px; border-radius:9px;
      border:1px solid #49305e; color:#fff; text-decoration:none; font-size:12px; font-weight:800;
      transition:transform .2s ease, background .2s ease;
    }
    .button:hover { transform:translateY(-2px); background:#21122e; }
    .button.primary { border-color:transparent; background:linear-gradient(90deg,#7c3aed,#a855f7); }
    .footer { margin-top:34px; color:#5f536a; font-size:10px; }
    @media (max-width:600px) {
      .card { padding:42px 20px; }
      .cloud { transform:scale(.82); margin-top:-8px; margin-bottom:10px; }
      .typewriter { white-space:normal; border-right:0; animation:none; }
    }
  </style>
</head>
<body>
  <main class="page">
    <div class="background"><div class="glow"></div></div>
    <section class="card">
      <img class="logo" src="/kernel-logo.svg" alt="Kernel" />
      <div class="cloud" aria-hidden="true">
        <div class="error-x">×</div>
        <div class="cloud-shape"></div>
      </div>
      <p class="eyebrow">KERNEL CLOUD</p>
      <h1><span class="typewriter">This page does not exist</span></h1>
      <p class="description">The website you're looking for hasn't been published to Kernel Cloud, doesn't exist, or may have been removed.</p>
      <div class="owner">TRUE TREASURE_TT <span>·</span> KERNEL CLOUD</div>
      <div class="buttons">
        <a class="button primary" href="/">Go to Kernel</a>
        <a class="button" href="/dashboard">Open Publisher</a>
      </div>
      <div class="footer">Powered by Kernel Publish</div>
    </section>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
