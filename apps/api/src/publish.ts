import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "./db";

export interface UploadedSiteFile {
  path: string;
  buffer: Buffer;
  contentType?: string;
}

const PUBLISH_ROOT =
  process.env.PUBLISH_ROOT ||
  path.join(process.cwd(), "published");

function safeRelativePath(input: string) {
  const normalized = input.replaceAll("\\", "/").replace(/^\/+/, "");
  const clean = path.posix.normalize(normalized);
  if (!clean || clean === "." || clean.startsWith("../") || clean.includes("/../") || clean.includes("\0")) {
    throw new Error(`Invalid website file path: ${input}`);
  }
  return clean;
}

export async function publishProjectFiles(
  projectId: string,
  files: UploadedSiteFile[],
  hostname: string
) {
  if (!files.length) throw new Error("At least one website file is required");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  const normalizedFiles = files.map((file) => ({
    ...file,
    path: safeRelativePath(file.path)
  }));

  const index = normalizedFiles.find((file) => file.path.toLowerCase() === "index.html");
  if (!index) throw new Error("Your website must contain an index.html file");

  const totalBytes = normalizedFiles.reduce((sum, file) => sum + file.buffer.length, 0);
  if (totalBytes > 50 * 1024 * 1024) throw new Error("Website is larger than the 50 MB limit");

  const latest = await prisma.deployment.findFirst({
    where: { projectId },
    orderBy: { version: "desc" }
  });

  const version = (latest?.version ?? 0) + 1;
  const deployment = await prisma.deployment.create({
    data: { projectId, version, status: "BUILDING" }
  });

  try {
    const releaseId = randomUUID();
    const outputDirectory = path.join(PUBLISH_ROOT, project.slug, releaseId);
    await mkdir(outputDirectory, { recursive: true });

    for (const file of normalizedFiles) {
      const destination = path.join(outputDirectory, ...file.path.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, file.buffer);
    }

    await prisma.deploymentFile.createMany({
      data: normalizedFiles.map((file) => ({
        deploymentId: deployment.id,
        path: file.path,
        size: file.buffer.length,
        contentType: file.contentType
      }))
    });

    const outputUrl = `https://${hostname}`;

    await prisma.domain.upsert({
      where: { hostname },
      update: { projectId, verified: true },
      create: { hostname, projectId, verified: true }
    });

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "READY", outputUrl, completedAt: new Date() }
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "PUBLISHED" }
    });

    return { deploymentId: deployment.id, url: outputUrl, version, fileCount: normalizedFiles.length };
  } catch (error) {
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown publishing error"
      }
    });
    throw error;
  }
}
