import type {
  SoftOneEvidenceRecord,
} from "./evidence-types";


export type SoftOneCrossSourceRelation =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "VARIANT"
  | "RELATED"
  | "NONE";


export type SoftOneCrossSourceResolution =
  | "VERIFIED"
  | "DERIVED"
  | "RECIPE_ONLY"
  | "VERSION_VARIANT"
  | "CONFLICT"
  | "UNRESOLVED";


export interface SoftOneCrossSourceMatch {
  evidenceId: string;

  relation:
    SoftOneCrossSourceRelation;

  reason: string;

  evidence:
    SoftOneEvidenceRecord;
}


export interface SoftOneCrossSourceImplementationMember {
  evidenceId: string;

  repository: string;

  reviewStatus?:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "RESOLVED";

  claim: string;

  kind: string;

  commit?: string;

  sourceFiles?: string[];
}


export interface SoftOneCrossSourceTarget {
  bucket: string;

  key: string;

  claim: string;

  title: string;

  confidence: number;

  repositories: string[];

  reviewedRepositories: string[];

  members:
    SoftOneCrossSourceImplementationMember[];

  tags: string[];
}


export interface SoftOneCrossSourceResolutionResult {
  target:
    SoftOneCrossSourceTarget;

  resolution:
    SoftOneCrossSourceResolution;

  authoritativeSupport:
    SoftOneCrossSourceMatch[];

  authoritativeContradictions:
    SoftOneCrossSourceMatch[];

  authoritativeVariants:
    SoftOneCrossSourceMatch[];

  relatedAuthoritativeEvidence:
    SoftOneCrossSourceMatch[];

  officialWsSupport:
    SoftOneCrossSourceMatch[];

  blackBookSupport:
    SoftOneCrossSourceMatch[];

  rationale:
    string[];

  resolvedAt:
    string;
}


export interface SoftOneCrossSourceResolutionFile {
  formatVersion: 1;

  capabilityKey: string;

  generatedAt: string;

  sourceFile: string;

  results:
    SoftOneCrossSourceResolutionResult[];
}
