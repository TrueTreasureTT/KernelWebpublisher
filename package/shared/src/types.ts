export type ProjectStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ARCHIVED";

export type DeploymentStatus =
  | "QUEUED"
  | "BUILDING"
  | "READY"
  | "FAILED";

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  source: string;
  status: ProjectStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  version: number;
  outputUrl?: string | null;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface Domain {
  id: string;
  hostname: string;
  projectId: string;
  verified: boolean;
}
