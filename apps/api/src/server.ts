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
function normalizeHostname(value: string) { return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""); }
function validateHostname(hostname: string) {
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) throw new Error("Enter a valid domain such as example.kernel.app");
  const base = (process.env.BASE_DOMAIN || "kernel.app").toLowerCase();
  if (!hostname.endsWith(`.${base}`) && hostname !== base) throw new Error(`Domain must end with .${base}`);
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
  const auth = getAuth(request); if (!auth) return reply.code(401).send({ error: "Unauthorized" });
  return prisma.project.findMany({ where: { userId: auth.userId }, include: { domains: true, deployments: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } });
});

app.post("/publish", async (request, reply) => {
  const auth = getAuth(request); if (!auth) return reply.code(401).send({ error: "Unauthorized" });
  const parts = request.parts();
  let name = "Website"; let domain = ""; let filePaths: string[] = [];
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
    const existingDomain = await prisma.domain.findUnique({ where: { hostname: domain } });
    if (existingDomain) {
      const owner = await prisma.project.findFirst({ where: { id: existingDomain.projectId, userId: auth.userId } });
      if (!owner) return reply.code(409).send({ error: "That domain is already in use" });
    }
    const index = files.find((file) => file.path.toLowerCase().split("/").at(-1) === "index.html");
    const source = index?.buffer.toString("utf8") || "";
    const project = await prisma.project.upsert({
      where: { userId_slug: { userId: auth.userId, slug } },
      update: { name, source },
      create: { name, slug, source, userId: auth.userId }
    });
    return reply.send(await publishProjectFiles(project.id, files, domain));
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : "Publishing failed" });
  }
});

const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf" };

// Requests reaching this API with a configured website Host are served from that site's latest READY deployment.
app.get("/*", async (request, reply) => {
  const hostname = request.hostname.toLowerCase().split(":")[0];
  if (!hostname.includes(".")) return reply.code(404).send({ error: "Not found" });
  const domain = await prisma.domain.findUnique({ where: { hostname } });
  if (!domain?.verified) return reply.code(404).send({ error: "Website not found" });
  const deployment = await prisma.deployment.findFirst({ where: { projectId: domain.projectId, status: "READY" }, orderBy: { version: "desc" } });
  if (!deployment?.releasePath) return reply.code(404).send({ error: "Website has not been published" });
  const requested = decodeURIComponent(request.url.split("?")[0].replace(/^\//, "")) || "index.html";
  const normalized = path.posix.normalize(requested);
  if (normalized.startsWith("../") || normalized.includes("/../")) return reply.code(400).send({ error: "Invalid path" });
  const file = await prisma.deploymentFile.findUnique({ where: { deploymentId_path: { deploymentId: deployment.id, path: normalized } } });
  if (!file) return reply.code(404).send({ error: "File not found" });
  try {
    const body = await readFile(path.join(deployment.releasePath, ...normalized.split("/")));
    reply.header("Cache-Control", "public, max-age=60");
    return reply.type(mime[path.extname(normalized).toLowerCase()] || "application/octet-stream").send(body);
  } catch { return reply.code(404).send({ error: "File not found" }); }
});

const port = Number(process.env.PORT) || 4000;
await app.listen({ port, host: "0.0.0.0" });
