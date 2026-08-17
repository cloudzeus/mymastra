import type {
  SoftOneProductArea,
  SoftOneSourceReference,
} from "./source-types";

export type SoftOneEvidenceStatus =
  | "VERIFIED"
  | "DERIVED"
  | "HYPOTHESIS";

export type SoftOneEvidenceScope =
  | "GLOBAL"
  | "TENANT"
  | "VERSION"
  | "RECIPE";

export type SoftOneClaimKind =
  | "API_BEHAVIOR"
  | "FUNCTION"
  | "OBJECT_BEHAVIOR"
  | "FIELD_SEMANTICS"
  | "RELATION"
  | "PHYSICAL_MAPPING"
  | "SQL_PATTERN"
  | "SCRIPT_PATTERN"
  | "FORM_BEHAVIOR"
  | "EVENT_BEHAVIOR"
  | "TENANT_RULE"
  | "VERSION_BEHAVIOR"
  | "BUSINESS_SEMANTIC";

export interface SoftOneEvidenceRecord {
  id: string;

  claim: string;

  kind: SoftOneClaimKind;

  status: SoftOneEvidenceStatus;

  scope: SoftOneEvidenceScope;

  tenantCode?: string;

  softOneVersion?: string;

  productAreas: SoftOneProductArea[];

  sources: SoftOneSourceReference[];

  dependsOn?: string[];

  conditions?: string[];

  limitations?: string[];

  verificationNotes?: string[];

  tags?: string[];

  createdAt?: string;

  updatedAt?: string;
}

export interface SoftOneEvidenceValidation {
  valid: boolean;

  errors: string[];

  warnings: string[];

  effectiveStatus: SoftOneEvidenceStatus;

  sourceAuthorities: string[];
}
