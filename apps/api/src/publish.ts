import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "./db";

const PUBLISH_ROOT =
  process.env.PUBLISH_ROOT ||
  path.join(process.cwd(), "published");

function validateHtml(source: string) {
  if (!source.trim()) {
    throw new Error("Website source cannot be empty");
  }

  if (source.length > 10_000_000) {
    throw new Error("Website source is too large");
  }
}

export async function publishProject(
  projectId: string
) {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  validateHtml(project.source);

  const latest =
    await prisma.deployment.findFirst({
      where: {
        projectId
      },
      orderBy: {
        version: "desc"
      }
    });

  const version =
    (latest?.version ?? 0) + 1;

  const deployment =
    await prisma.deployment.create({
      data: {
        projectId,
        version,
        status: "BUILDING"
      }
    });

  try {
    const releaseId = randomUUID();

    const outputDirectory = path.join(
      PUBLISH_ROOT,
      project.slug,
      releaseId
    );

    await mkdir(
      outputDirectory,
      { recursive: true }
    );

    await writeFile(
      path.join(
        outputDirectory,
        "index.html"
      ),
      project.source,
      "utf8"
    );

    const hostname =
      `${project.slug}.${process.env.BASE_DOMAIN}`;

    const outputUrl =
      `https://${hostname}`;

    await prisma.deployment.update({
      where: {
        id: deployment.id
      },
      data: {
        status: "READY",
        outputUrl,
        completedAt: new Date()
      }
    });

    await prisma.project.update({
      where: {
        id: project.id
      },
      data: {
        status: "PUBLISHED"
      }
    });

    return {
      deploymentId: deployment.id,
      url: outputUrl
    };
  } catch (error) {
    await prisma.deployment.update({
      where: {
        id: deployment.id
      },
      data: {
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Unknown publishing error"
      }
    });

    throw error;
  }
}
