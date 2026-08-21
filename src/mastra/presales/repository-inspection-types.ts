export type RepositoryInspectionStatus =
  | "READY"
  | "PARTIAL"
  | "BLOCKED"
  | "FAILED";


export type RepositoryFindingCategory =
  | "ARCHITECTURE"
  | "DEPENDENCY"
  | "DATA_LAYER"
  | "AUTHENTICATION"
  | "INTEGRATION"
  | "PERFORMANCE"
  | "SECURITY"
  | "TESTING"
  | "DEPLOYMENT"
  | "TECHNICAL_DEBT"
  | "OTHER";


export type RepositoryFindingConfidence =
  | "VERIFIED"
  | "INFERRED";


export type RepositoryFileReference = {
  path: string;

  lineStart?: number;
  lineEnd?: number;
};


export type RepositoryInspectionFinding = {
  id: string;

  category:
    RepositoryFindingCategory;

  statement: string;

  confidence:
    RepositoryFindingConfidence;

  fileRefs:
    RepositoryFileReference[];

  notes: string[];
};


export type RepositoryInspection = {
  id: string;

  tenantId: string;
  customerId: string;
  opportunityId: string;

  presalesSourceId: string;

  version: number;

  repositoryUrl: string;

  requestedRef?: string;

  resolvedRef?: string;
  resolvedCommit?: string;

  detectedStack: string[];

  architecture: string[];

  modules: string[];

  integrations: string[];

  dataLayer: string[];

  authentication: string[];

  deployment: string[];

  testing: string[];

  relevantFiles: string[];

  findings:
    RepositoryInspectionFinding[];

  risks: string[];

  technicalDebt: string[];

  limitations: string[];

  status:
    RepositoryInspectionStatus;

  createdAt: string;
};


export type CreateRepositoryInspectionInput = {
  tenantId: string;
  customerId: string;
  opportunityId: string;

  presalesSourceId: string;

  repositoryUrl: string;

  requestedRef?: string;

  resolvedRef?: string;
  resolvedCommit?: string;

  detectedStack?: string[];

  architecture?: string[];

  modules?: string[];

  integrations?: string[];

  dataLayer?: string[];

  authentication?: string[];

  deployment?: string[];

  testing?: string[];

  relevantFiles?: string[];

  findings?:
    RepositoryInspectionFinding[];

  risks?: string[];

  technicalDebt?: string[];

  limitations?: string[];

  status:
    RepositoryInspectionStatus;
};
