export type ProjectStatus =
  | "DRAFT"
  | "ACTIVE"
  | "BLOCKED"
  | "COMPLETED"
  | "ARCHIVED";


export type Project = {
  id: string;

  tenantId: string;

  code: string;

  name: string;

  description?: string;

  status:
    ProjectStatus;

  createdAt: string;

  updatedAt: string;
};


export type CreateProjectInput = {
  tenantId: string;

  code: string;

  name: string;

  description?: string;

  status?:
    ProjectStatus;
};


export type UpdateProjectInput = {
  name?: string;

  description?: string | null;

  status?:
    ProjectStatus;
};


export type ProjectWorkspaceStatus =
  | "PROVISIONING"
  | "READY"
  | "BLOCKED"
  | "ARCHIVED";


export type ProjectWorkspace = {
  id: string;

  projectId: string;

  workspacePath: string;

  repositoryUrl?: string;

  baseBranch?: string;

  status:
    ProjectWorkspaceStatus;

  createdAt: string;

  updatedAt: string;
};


export type CreateProjectWorkspaceInput = {
  projectId: string;

  repositoryUrl?: string;

  baseBranch?: string;
};


export type UpdateProjectWorkspaceInput = {
  repositoryUrl?: string | null;

  baseBranch?: string | null;

  status?:
    ProjectWorkspaceStatus;
};


export type ProjectIntegrationBinding = {
  id: string;

  projectId: string;

  tenantId: string;

  providerId: string;

  providerCode: string;

  environment:
    "PRODUCTION"
    | "TEST"
    | "DEVELOPMENT";

  connectionId: string;

  isActive: boolean;

  createdAt: string;

  updatedAt: string;
};


export type CreateProjectIntegrationBindingInput = {
  projectId: string;

  providerCode: string;

  environment:
    "PRODUCTION"
    | "TEST"
    | "DEVELOPMENT";

  connectionId: string;
};


export type UpdateProjectIntegrationBindingInput = {
  connectionId?: string;

  isActive?: boolean;
};
