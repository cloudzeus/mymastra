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


export type SoftOneAccessPolicy = {
  transport:
    "WEB_SERVICES_ONLY";

  directDatabaseAccess:
    "UNAVAILABLE";

  dataExplorerExecution:
    "ADMIN_MANUAL_ONLY";

  webServicesReadAllowed:
    boolean;

  webServicesUpsertAllowed:
    boolean;

  sqlScriptGenerationAllowed:
    boolean;

  sqlScriptInstallation:
    "ADMIN_MANUAL_ONLY";

  sqlScriptInvocation:
    "WEB_SERVICES_ONLY";

  advancedJavaScriptGenerationAllowed:
    boolean;

  advancedJavaScriptInstallation:
    "ADMIN_MANUAL_ONLY";

  advancedJavaScriptInvocation:
    "WEB_SERVICES_ONLY";
};


export type DeveloperExecutionPolicy = {
  workspaceResolvedByProjectId: true;

  arbitraryWorkspacePathAllowed: false;

  shellExecutionAllowed: false;

  /*
   * This controls the Developer agent itself.
   * It does not prohibit generated application code
   * from implementing an authorized integration.
   */
  networkAccessAllowed: false;

  gitCommitAllowed: false;

  gitPushAllowed: false;

  softOneAccessPolicy:
    SoftOneAccessPolicy;

  /*
   * For SoftOne implementation work, object/table/field assumptions
   * must be verified against tenant live Web Services metadata when
   * an active SoftOne connection is available.
   *
   * The Developer agent itself does not receive credentials or
   * unrestricted network access. Discovery is a server-side preflight.
   */
  softOneLiveMetadataPreflightRequired: boolean;
};




export type DeveloperArtifactContract = {
  /*
   * Canonical integration/release collection identifier.
   *
   * Example:
   * geniki-taxidromiki
   */
  collectionName: string;

  /*
   * This path is derived by the application.
   * The Developer agent does not choose an arbitrary root.
   */
  artifactRoot: string;

  softOne: {
    required: boolean;

    advancedJavaScriptGenerationRequired: boolean;

    manualInstallationRequired: true;

    autoInstallationAllowed: false;

    directory: string;

    installationGuidePath: string;

    readmePath: string;
  };

  api: {
    required: boolean;

    /*
     * OpenAPI is the canonical machine-readable
     * contract of the implemented HTTP API.
     */
    openApiRequired: boolean;

    openApiPath: string;

    /*
     * Postman is a mandatory distribution/testing artifact
     * and must remain compatible with OpenAPI.
     */
    postmanRequired: boolean;

    postmanPath: string;

    sourceOfTruth:
      "OPENAPI";
  };

  mappings: {
    required: boolean;

    directory: string;

    softOneMappingPath: string;

    externalClientMappingPath: string;
  };

  documentation: {
    required: true;

    directory: string;

    apiDocumentationPath: string;

    integrationGuidePath: string;

    thirdPartyDeveloperGuidePath: string;

    softOneIntegrationGuidePath: string;
  };

  qa: {
    handoffRequired: true;

    directory: string;

    handoffManifestPath: string;

    testMatrixPath: string;

    /*
     * Reserved for the QA agent.
     * Developer must not claim this report was produced.
     */
    qaReportPath: string;

    documentationValidationRequired: true;

    openApiValidationRequired: boolean;

    postmanValidationRequired: boolean;
  };
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

  /*
   * Deterministic deliverable contract owned by the application.
   *
   * The Developer must materialize the required artifacts
   * inside the project workspace using developer-write-file.
   */
  artifactContract:
    DeveloperArtifactContract;

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
