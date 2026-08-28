CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT,
  "password" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Project_userId_slug_key" UNIQUE ("userId", "slug")
);
CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");

CREATE TABLE IF NOT EXISTS "Deployment" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "version" INTEGER NOT NULL,
  "outputUrl" TEXT,
  "releasePath" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP,
  CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Deployment_projectId_idx" ON "Deployment"("projectId");

CREATE TABLE IF NOT EXISTS "DeploymentFile" (
  "id" TEXT PRIMARY KEY,
  "deploymentId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "contentType" TEXT,
  CONSTRAINT "DeploymentFile_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE,
  CONSTRAINT "DeploymentFile_deploymentId_path_key" UNIQUE ("deploymentId", "path")
);
CREATE INDEX IF NOT EXISTS "DeploymentFile_deploymentId_idx" ON "DeploymentFile"("deploymentId");

CREATE TABLE IF NOT EXISTS "Domain" (
  "id" TEXT PRIMARY KEY,
  "hostname" TEXT NOT NULL UNIQUE,
  "projectId" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Domain_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Domain_projectId_idx" ON "Domain"("projectId");

-- Safe upgrades for databases created from the previous schema.
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "releasePath" TEXT;
