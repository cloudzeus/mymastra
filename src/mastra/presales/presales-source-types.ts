export type PresalesSourceType =
  | "REPOSITORY"
  | "WEBSITE"
  | "DOCUMENT"
  | "API_SPEC"
  | "DATABASE_SCHEMA"
  | "LOG_EXPORT"
  | "OTHER";


export type PresalesSourceStatus =
  | "PENDING"
  | "READY"
  | "FAILED"
  | "REVOKED";


export type RepositoryProvider =
  | "GITHUB"
  | "GITLAB"
  | "BITBUCKET"
  | "GENERIC_GIT";


export type PresalesSource = {
  id: string;

  tenantId: string;
  customerId: string;
  opportunityId: string;

  sourceType:
    PresalesSourceType;

  title: string;

  reference?: string;

  repositoryProvider?:
    RepositoryProvider;

  repositoryUrl?: string;

  requestedRef?: string;

  accessMode:
    "READ_ONLY";

  metadata:
    Record<string, unknown>;

  status:
    PresalesSourceStatus;

  createdAt: string;
  updatedAt: string;
};


export type CreatePresalesSourceInput = {
  tenantId: string;
  customerId: string;
  opportunityId: string;

  sourceType:
    PresalesSourceType;

  title: string;

  reference?: string;

  repositoryProvider?:
    RepositoryProvider;

  repositoryUrl?: string;

  requestedRef?: string;

  metadata?:
    Record<string, unknown>;

  status?:
    PresalesSourceStatus;
};
