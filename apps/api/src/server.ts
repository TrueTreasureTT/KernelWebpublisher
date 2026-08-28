import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import bcrypt from "bcryptjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { createToken, verifyToken } from "./auth";
import { publishProjectFiles, type UploadedSiteFile } from "./publish";

const app = Fastify({ logger: true });
const publishRoot = process.env.PUBLISH_ROOT || path.join(process.cwd(), "published");
await app.register(cors, { origin: true });
await app.register(multipart, { limits: { files: 200, fileSize: 50 * 1024 * 1024, parts: 205 } });

function getAuth(request: { headers: { authorization?: string } }) {
  const value = request.headers.authorization;
  if (!value?.startsWith("Bearer ")) return null;
  try { return verifyToken(value.substring(7)); } catch { return null; }
}

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function validateHostname(hostname: string) {
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) {
    throw new Error("Enter a valid domain such as example.kernel.app");
  }
  const base = (process.env.BASE_DOMAIN || "example.kernel.app").toLowerCase();
  if (!hostname.endsWith(`.${base}`) && hostname !== base) {
    throw new Error(`Domain must end with .${base}`);
  }
}

function notFoundPage(title = "This page does not exist") {
  const baseDomain = process.env.BASE_DOMAIN || "example.kernel.app";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title} - TrueTreasure_TT</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:#08050d;color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{min-height:100vh;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 38%,#29103e 0,#11091b 34%,#08050d 70%)}
.wrap{width:min(760px,calc(100% - 40px));text-align:center;padding:54px 24px}
.cloud{position:relative;width:150px;height:104px;margin:0 auto 34px;color:#fff;filter:drop-shadow(0 18px 42px rgba(147,51,234,.24));font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:14px;font-weight:800;line-height:1;display:grid;place-items:center}
.cloud:before{content:"";position:absolute;inset:21px 0 0;border:3px solid #fff;border-radius:55px 55px 22px 22px;background:linear-gradient(180deg,#24112f,#130a1c);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.cloud:after{content:"";position:absolute;width:68px;height:68px;left:42px;top:0;border:3px solid #fff;border-bottom:0;border-radius:50% 50% 0 0;background:#24112f;z-index:0}
.cloud span{position:relative;z-index:1;display:block;padding-top:31px;color:#b879ff;text-shadow:0 0 18px rgba(184,121,255,.55)}
.x{position:absolute;z-index:3;right:-10px;top:-12px;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#180b12;border:4px solid #ff4057;box-shadow:0 0 28px rgba(255,64,87,.35);color:#ff4057;font-family:Arial,sans-serif;font-size:28px;font-weight:900}
h1{margin:0;font-size:clamp(32px,6vw,58px);letter-spacing:-.055em;line-height:1.05;background:linear-gradient(90deg,#fff,#d8b4ff,#fff);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin:17px auto 0;color:#a99ab5;font-size:15px;line-height:1.7;max-width:570px}
.typed{display:inline-block;overflow:hidden;white-space:nowrap;border-right:2px solid #b66cff;max-width:0;animation:typing 2.2s steps(27,end) .15s forwards,blink .7s step-end infinite}
.meta{margin:30px auto 0;width:min(560px,100%);padding:14px 16px;border:1px solid #352142;background:rgba(19,10,29,.78);border-radius:12px;color:#75677f;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.meta b{color:#c697ff}
.brand{margin-top:30px;color:#776a82;font-size:11px;letter-spacing:.16em;font-weight:800}
@keyframes typing{from{max-width:0}to{max-width:27ch}}
@keyframes blink{50%{border-color:transparent}}
@media(max-width:520px){.cloud{transform:scale(.86);margin-bottom:20px}.sub{font-size:14px}.meta{font-size:11px}}
</style>
</head>
<body>
<main class="wrap">
  <div class="cloud" aria-label="Kernel cloud"><div class="x">×</div><span>KERNEL</span></div>
  <h1><span class="typed">This page does not exist</span></h1>
  <p class="sub">The website you're looking for hasn't been published to Kernel Cloud yet, or the address is incorrect.</p>
  <div class="meta">Requested cloud: <b>${baseDomain}</b><br/>Publish a project from Kernel Publisher to make this address live.</div>
  <div class="brand">TRUE TREASURE_TT · KERNEL CLOUD</div>
</main>
</body>
</html>`;
}

app.get("/health", async () => ({ status: "ok" }));

app.post<{ Body: { email: string; password: string; name?: string } }>("/auth/register", async (request, reply) => {
  const { email, password, name } = request.body;
  if (!email || !password) return reply.code(400).send({ error: "Email and password are required" });
  if (password.length < 8) return reply.code(400).send({ error: "Password must be at least 8 characters" });
  if (await prisma.user.findUnique({ where: { email } })) return reply.code(409).send({ error: "Email already registered" });
  const user = await prisma.user.create({ data: { email, name, password: await bcrypt.hash(password, 12) } });
  return { token: createToken(user.id), user: { id: user.id, email: user.email, name: user.name } };
});

app.post<{ Body: { email: string; password: string } }>("/auth/login", async (request, reply) => {
  const { email, password } = request.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) return reply.code(401).send({ error: "Invalid credentials" });
  return { token: createToken(user.id), user: { id: user.id, email: user.email, name: user.name } };
});

app.get("/projects", async (request, reply) => {
  const auth = getAuth(request);
  if (!auth) return reply.code(401).send({ error: "Unauthorized" });
  return prisma.project.findMany({ where: { userId: auth.userId }, include: { domains: true, deployments: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } });
});

app.post("/publish", async (request, reply) => {
  const auth = getAuth(request);
  if (!auth) return reply.code(401).send({ error: "Unauthorized" });
  const parts = request.parts();
  let name = "Website", domain = "", filePaths: string[] = [];
  const files: UploadedSiteFile[] = [];
  try {
    for await (const part of parts) {
      if (part.type === "field") {
        if (part.fieldname === "name") name = String(part.value).trim() || "Website";
        if (part.fieldname === "domain") domain = normalizeHostname(String(part.value));
        if (part.fieldname === "filePaths") filePaths = JSON.parse(String(part.value));
        continue;
      }
      if (part.fieldname !== "files") continue;
      files.push({ path: part.filename, buffer: await part.toBuffer(), contentType: part.mimetype });
    }
    validateHostname(domain);
    if (!files.length) throw new Error("Drop at least one website file");
    if (filePaths.length !== files.length) throw new Error("Website file paths are invalid");
    files.forEach((file, index) => { file.path = filePaths[index]; });
    const slug = domain.split(".")[0];
    const existing = await prisma.domain.findUnique({ where: { hostname: domain } });
    if (existing) {
      const owner = await prisma.project.findFirst({ where: { id: existing.projectId, userId: auth.userId } });
      if (!owner) return reply.code(409).send({ error: "That domain is already in use" });
    }
    const index = files.find(file => file.path.toLowerCase().split("/").at(-1) === "index.html");
    const source = index?.buffer.toString("utf8") || "";
    const project = await prisma.project.upsert({ where: { userId_slug: { userId: auth.userId, slug } }, update: { name, source }, create: { name, slug, source, userId: auth.userId } });
    return reply.send(await publishProjectFiles(project.id, files, domain));
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : "Publishing failed" });
  }
});

const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf" };

app.get("/*", async (request, reply) => {
  const hostname = request.hostname.toLowerCase().split(":")[0];
  if (!hostname.includes(".")) return reply.code(404).type("text/html; charset=utf-8").send(notFoundPage());
  const domain = await prisma.domain.findUnique({ where: { hostname } });
  if (!domain?.verified) return reply.code(404).type("text/html; charset=utf-8").send(notFoundPage());
  const deployment = await prisma.deployment.findFirst({ where: { projectId: domain.projectId, status: "READY" }, orderBy: { version: "desc" } });
  if (!deployment?.releasePath) return reply.code(404).type("text/html; charset=utf-8").send(notFoundPage());
  const requested = decodeURIComponent(request.url.split("?")[0].replace(/^\//, "")) || "index.html";
  const normalized = path.posix.normalize(requested);
  if (normalized.startsWith("../") || normalized.includes("/../")) return reply.code(400).send({ error: "Invalid path" });
  const file = await prisma.deploymentFile.findUnique({ where: { deploymentId_path: { deploymentId: deployment.id, path: normalized } } });
  if (!file) return reply.code(404).type("text/html; charset=utf-8").send(notFoundPage());
  try {
    const body = await readFile(path.join(deployment.releasePath, ...normalized.split("/")));
    reply.header("Cache-Control", "public, max-age=60");
    return reply.type(mime[path.extname(normalized).toLowerCase()] || "application/octet-stream").send(body);
  } catch {
    return reply.code(404).type("text/html; charset=utf-8").send(notFoundPage());
  }
});

const port = Number(process.env.PORT) || 4000;
await app.listen({ port, host: "0.0.0.0" });
