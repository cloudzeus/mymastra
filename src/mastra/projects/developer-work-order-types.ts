import type {
  ProjectDefinitionPackage,
} from "./project-definition-types";


export type DeveloperTaskType =
  | "APPLICATION_SCAFFOLD"
  | "DATA_MODEL"
  | "API_CONTRACT"
  | "SOFTONE_INTEGRATION"
  | "SYNC_WORKER"
  | "BUSINESS_LOGIC"
  | "UI"
  | "TEST"
  | "REFACTOR"
  | "DOCUMENTATION";


export type DeveloperWorkOrderStatus =
  | "DRAFT"
  | "READY"
  | "BLOCKED"
  | "COMPLETED";


export type DeveloperAllowedScope = {
  /*
   * Relative paths only.
   * Never a workspacePath and never an absolute filesystem path.
   */
  paths: string[];

  allowCreate: boolean;

  allowModify: boolean;

  allowDelete: boolean;
};


export type DeveloperRequiredArtifact = {
  id: string;

  type:
    | "REQUIREMENT"
    | "KNOWLEDGE_REFERENCE"
    | "STRUCTURED_SQL_PLAN"
    | "INTEGRATION_REQUIREMENT"
    | "USER_VERIFIED_ARTIFACT";

  referenceId: string;

  required: boolean;
};


export type DeveloperExecutionPolicy = {
  workspaceResolvedByProjectId: true;

  arbitraryWorkspacePathAllowed: false;

  shellExecutionAllowed: false;

  directErpDatabaseExecutionAllowed: false;

  softOneWriteExecutionAllowed: false;

  gitCommitAllowed: false;

  gitPushAllowed: false;

  networkAccessAllowed: false;
};


export type DeveloperWorkOrder = {
  id: string;

  projectId: string;

  projectDefinitionId: string;

  projectDefinitionVersion: number;

  taskId: string;

  taskType:
    DeveloperTaskType;

  objective: string;

  allowedScope:
    DeveloperAllowedScope;

  requiredArtifacts:
    DeveloperRequiredArtifact[];

  acceptanceCriteria:
    string[];

  executionPolicy:
    DeveloperExecutionPolicy;

  status:
    DeveloperWorkOrderStatus;

  blockers:
    string[];

  createdAt: string;

  updatedAt: string;
};


export type DeveloperWorkOrderValidation = {
  valid: boolean;

  errors: string[];

  warnings: string[];

  projectDefinition?: ProjectDefinitionPackage;
};
