import "dotenv/config";

import Fastify from "fastify";
import cors from "@fastify/cors";
import bcrypt from "bcryptjs";

import { prisma } from "./db";
import {
  createToken,
  verifyToken
} from "./auth";
import {
  publishProject
} from "./publish";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
});

app.get("/health", async () => {
  return {
    status: "ok"
  };
});

app.post<{
  Body: {
    email: string;
    password: string;
    name?: string;
  };
}>("/auth/register", async (request, reply) => {
  const {
    email,
    password,
    name
  } = request.body;

  if (!email || !password) {
    return reply.code(400).send({
      error: "Email and password are required"
    });
  }

  if (password.length < 8) {
    return reply.code(400).send({
      error:
        "Password must be at least 8 characters"
    });
  }

  const existing =
    await prisma.user.findUnique({
      where: {
        email
      }
    });

  if (existing) {
    return reply.code(409).send({
      error: "Email already registered"
    });
  }

  const passwordHash =
    await bcrypt.hash(password, 12);

  const user =
    await prisma.user.create({
      data: {
        email,
        name,
        password: passwordHash
      }
    });

  return {
    token: createToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  };
});

app.post<{
  Body: {
    email: string;
    password: string;
  };
}>("/auth/login", async (request, reply) => {
  const {
    email,
    password
  } = request.body;

  const user =
    await prisma.user.findUnique({
      where: {
        email
      }
    });

  if (!user) {
    return reply.code(401).send({
      error: "Invalid credentials"
    });
  }

  const valid =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!valid) {
    return reply.code(401).send({
      error: "Invalid credentials"
    });
  }

  return {
    token: createToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  };
});

app.get("/projects", async (request, reply) => {
  const authorization =
    request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return reply.code(401).send({
      error: "Unauthorized"
    });
  }

  let auth;

  try {
    auth = verifyToken(
      authorization.substring(7)
    );
  } catch {
    return reply.code(401).send({
      error: "Invalid token"
    });
  }

  const projects =
    await prisma.project.findMany({
      where: {
        userId: auth.userId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

  return projects;
});

app.post<{
  Body: {
    name: string;
    slug: string;
    description?: string;
    source: string;
  };
}>("/projects", async (request, reply) => {
  const authorization =
    request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return reply.code(401).send({
      error: "Unauthorized"
    });
  }

  let auth;

  try {
    auth = verifyToken(
      authorization.substring(7)
    );
  } catch {
    return reply.code(401).send({
      error: "Invalid token"
    });
  }

  const {
    name,
    slug,
    description,
    source
  } = request.body;

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return reply.code(400).send({
      error:
        "Slug can only contain lowercase letters, numbers, and hyphens"
    });
  }

  const project =
    await prisma.project.create({
      data: {
        name,
        slug,
        description,
        source,
        userId: auth.userId
      }
    });

  return project;
});

app.post<{
  Params: {
    id: string;
  };
}>("/projects/:id/publish", async (
  request,
  reply
) => {
  const authorization =
    request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return reply.code(401).send({
      error: "Unauthorized"
    });
  }

  let auth;

  try {
    auth = verifyToken(
      authorization.substring(7)
    );
  } catch {
    return reply.code(401).send({
      error: "Invalid token"
    });
  }

  const project =
    await prisma.project.findFirst({
      where: {
        id: request.params.id,
        userId: auth.userId
      }
    });

  if (!project) {
    return reply.code(404).send({
      error: "Project not found"
    });
  }

  try {
    const result =
      await publishProject(project.id);

    return result;
  } catch (error) {
    return reply.code(500).send({
      error:
        error instanceof Error
          ? error.message
          : "Publishing failed"
    });
  }
});

const port =
  Number(process.env.PORT) || 4000;

await app.listen({
  port,
  host: "0.0.0.0"
});
