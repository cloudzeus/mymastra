import type {
  StructuredSqlPlan,
} from "../softone/structured-sql-plan-types";

import type {
  SemanticEvidence,
} from "../softone/semantic-types";

import type {
  IntegrationEnvironment,
} from "../integrations/types";


export type ProjectDefinitionStatus =
  | "DRAFT"
  | "PARTIAL"
  | "READY"
  | "BLOCKED";


export type ProjectRequirementStatus =
  | "VERIFIED"
  | "DERIVED"
  | "UNRESOLVED"
  | "BLOCKED";


export type ProjectRequirement = {
  id: string;

  statement: string;

  status:
    ProjectRequirementStatus;

  acceptanceCriteria:
    string[];

  sourceIds:
    string[];

  requiredForDevelopment:
    boolean;

  notes?: string[];
};


export type ProjectKnowledgeReference = {
  id: string;

  kind:
    | "SEMANTIC_NODE"
    | "EVIDENCE_RECORD"
    | "OBJECT_KNOWLEDGE"
    | "OBJECT_CONTRACT"
    | "REFERENCE_RESOLUTION"
    | "PAYLOAD_PLAN"
    | "USER_VERIFIED_ARTIFACT";

  referenceId: string;

  evidence:
    SemanticEvidence;

  tenantScoped:
    boolean;

  tenantCode?: string;

  description:
    string;
};


export type ProjectIntegrationRequirement = {
  id: string;

  providerCode: string;

  environment:
    IntegrationEnvironment;

  purpose: string;

  requiredCapabilities:
    string[];

  requiredForDevelopment:
    boolean;

  bindingRequired:
    boolean;
};


export type ProjectUnresolvedItem = {
  id: string;

  description: string;

  requiredForDevelopment:
    boolean;

  resolutionRequired:
    string;

  sourceIds:
    string[];
};


export type ProjectBlocker = {
  id: string;

  description: string;

  sourceIds:
    string[];

  resolutionRequired:
    string;
};


export type ProjectProvenanceReference = {
  sourceId: string;

  sourceType:
    | "USER_REQUIREMENT"
    | "SEMANTIC_NODE"
    | "EVIDENCE"
    | "STRUCTURED_SQL_PLAN"
    | "OBJECT_KNOWLEDGE"
    | "OBJECT_CONTRACT"
    | "INTEGRATION_REGISTRY"
    | "TENANT_RULE"
    | "USER_VERIFIED_ARTIFACT";

  evidence:
    SemanticEvidence;

  description?: string;
};


export type ProjectDefinitionPackage = {
  id: string;

  version: number;

  projectId: string;

  tenantId: string;

  tenantCode: string;

  status:
    ProjectDefinitionStatus;

  requirements:
    ProjectRequirement[];

  knowledgeReferences:
    ProjectKnowledgeReference[];

  structuredSqlPlans:
    StructuredSqlPlan[];

  integrationRequirements:
    ProjectIntegrationRequirement[];

  unresolved:
    ProjectUnresolvedItem[];

  blockers:
    ProjectBlocker[];

  provenance:
    ProjectProvenanceReference[];

  createdAt: string;

  updatedAt: string;
};


export type ProjectDefinitionValidation = {
  valid: boolean;

  errors: string[];

  warnings: string[];

  effectiveStatus:
    ProjectDefinitionStatus;
};
