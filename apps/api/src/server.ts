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
await app.register(multipart, {
  limits: { files: 200, fileSize: 50 * 1024 * 1024, parts: 205 }
});

function getAuth(request: { headers: { authorization?: string } }) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    return verifyToken(authorization.substring(7));
  } catch {
    return null;
  }
}

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function validateHostname(hostname: string) {
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) {
    throw new Error("Enter a valid domain such as example.kernel.app");
  }
  const base = (process.env.BASE_DOMAIN || "kernel.app").toLowerCase();
  if (!hostname.endsWith(`.${base}`) && hostname !== base) {
    throw new Error(`Domain must end with .${base}`);
  }
}

app.get("/health", async () => ({ status: "ok" }));

app.post<{ Body: { email: string; password: string; name?: string } }>("/auth/register", async (request, reply) => {
  const { email, password, name } = request.body;
  if (!email || !password) return reply.code(400).send({ error: "Email and password are required" });
  if (password.length < 8) return reply.code(400).send({ error: "Password must be at least 8 characters" });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return reply.code(409).send({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, name, password: passwordHash } });
  return { token: createToken(user.id), user: { id: user.id, email: user.email, name: user.name } };
});

app.post<{ Body: { email: string; password: string } }>("/auth/login", async (request, reply) => {
  const { email, password } = request.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return reply.code(401).send({ error: "Invalid credentials" });
  }
  return { token: createToken(user.id), user: { id: user.id, email: user.email, name: user.name } };
});

app.get("/projects", async (request, reply) => {
  const auth = getAuth(request);
  if (!auth) return reply.code(401).send({ error: "Unauthorized" });
  return prisma.project.findMany({
    where: { userId: auth.userId },
    include: { domains: true, deployments: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" }
  });
});

/**
 * Upload a complete static website.
 * Multipart fields: name, domain, and one or more files named "files".
 */
app.post("/publish", async (request, reply) => {
  const auth = getAuth(request);
  if (!auth) return reply.code(401).send({ error: "Unauthorized" });

  const parts = request.parts();
  let name = "Website";
  let domain = "";
  const files: UploadedSiteFile[] = [];

  try {
    for await (const part of parts) {
      if (part.type === "field") {
        if (part.fieldname === "name") name = String(part.value).trim() || "Website";
        if (part.fieldname === "domain") domain = normalizeHostname(String(part.value));
        continue;
      }

      if (part.fieldname !== "files") continue;
      const filename = part.filename.replaceAll("\\", "/").replace(/^\/+/, "");
      if (!filename || filename.includes("..")) throw new Error("Invalid file path");
      const buffer = await part.toBuffer();
      files.push({ path: filename, buffer, contentType: part.mimetype });
    }

    if (!domain) throw new Error("A domain is required");
    validateHostname(domain);
    if (!files.length) throw new Error("Drop at least one website file");

    const slug = domain.split(".")[0];
    const existingDomain = await prisma.domain.findUnique({ where: { hostname: domain } });
    if (existingDomain) {
      const ownerProject = await prisma.project.findFirst({
        where: { id: existingDomain.projectId, userId: auth.userId }
      });
      if (!ownerProject) return reply.code(409).send({ error: "That domain is already in use" });
    }

    const project = await prisma.project.upsert({
      where: { userId_slug: { userId: auth.userId, slug } },
      update: { name, source: (files.find((f) => f.path.toLowerCase() === "index.html")?.buffer.toString("utf8") || "") },
      create: {
        name,
        slug,
        source: files.find((f) => f.path.toLowerCase() === "index.html")?.buffer.toString("utf8") || "",
        userId: auth.userId
      }
    });

    const result = await publishProjectFiles(project.id, files, domain);
    return reply.send(result);
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : "Publishing failed" });
  }
});

app.post<{ Body: { name: string; slug: string; description?: string; source: string } }>("/projects", async (request, reply) => {
  const auth = getAuth(request);
  if (!auth) return reply.code(401).send({ error: "Unauthorized" });
  const { name, slug, description, source } = request.body;
  if (!/^[a-z0-9-]+$/.test(slug)) return reply.code(400).send({ error: "Invalid slug" });
  return prisma.project.create({ data: { name, slug, description, source, userId: auth.userId } });
});

app.post<{ Params: { id: string } }>("/projects/:id/publish", async (request, reply) => {
  const auth = getAuth(request);
  if (!auth) return reply.code(401).send({ error: "Unauthorized" });
  const project = await prisma.project.findFirst({ where: { id: request.params.id, userId: auth.userId } });
  if (!project) return reply.code(404).send({ error: "Project not found" });
  return reply.send({ error: "Use POST /publish with your website files" });
});

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

// Host-based static website delivery. Put a reverse proxy in front of this API in production.
app.get("/*", async (request, reply) => {
  const hostname = request.hostname.toLowerCase().split(":")[0];
  if (!hostname.includes(".")) return reply.code(404).send({ error: "Not found" });

  const domain = await prisma.domain.findUnique({ where: { hostname } });
  if (!domain?.verified) return reply.code(404).send({ error: "Website not found" });

  const deployment = await prisma.deployment.findFirst({
    where: { projectId: domain.projectId, status: "READY" },
    orderBy: { version: "desc" }
  });
  if (!deployment) return reply.code(404).send({ error: "Website has not been published" });

  const requested = decodeURIComponent(request.url.split("?")[0].replace(/^\//, ""));
  const relative = requested || "index.html";
  const normalized = path.posix.normalize(relative);
  if (normalized.startsWith("../") || normalized.includes("/../")) return reply.code(400).send({ error: "Invalid path" });

  const file = await prisma.deploymentFile.findUnique({ where: { deploymentId_path: { deploymentId: deployment.id, path: normalized } } });
  if (!file) return reply.code(404).send({ error: "File not found" });

  const diskPath = path.join(publishRoot, (await prisma.project.findUniqueOrThrow({ where: { id: domain.projectId } })).slug, path.basename((await prisma.deployment.findUniqueOrThrow({ where: { id: deployment.id } })).id));
  // Deployment directories are random UUIDs; locate the release using the deployment's file metadata.
  const { readdir } = await import("node:fs/promises");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: domain.projectId } });
  const releases = await readdir(path.join(publishRoot, project.slug), { withFileTypes: true });
  const release = releases.filter((entry) => entry.isDirectory()).at(-1);
  if (!release) return reply.code(404).send({ error: "Release not found" });

  try {
    const body = await readFile(path.join(publishRoot, project.slug, release.name, ...normalized.split("/")));
    reply.header("Cache-Control", "public, max-age=60");
    return reply.type(mime[path.extname(normalized).toLowerCase()] || "application/octet-stream").send(body);
  } catch {
    return reply.code(404).send({ error: "File not found" });
  }
});

const port = Number(process.env.PORT) || 4000;
await app.listen({ port, host: "0.0.0.0" });
