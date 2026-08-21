export type SoftOneCorroborationStatus =
  | "CANDIDATE"
  | "CORROBORATED"
  | "REVIEWED"
  | "REJECTED";

export interface SoftOneImplementationCorroborationMember {
  evidenceId: string;
  reviewId?: string;

  reviewStatus?:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "RESOLVED";

  repository: string;
  candidateId?: string;

  claim: string;

  kind: string;

  sourceFiles: string[];

  commit?: string;
}

export interface SoftOneImplementationCorroborationGroup {
  key: string;

  title: string;

  normalizedClaim: string;

  rationale: string;

  status:
    SoftOneCorroborationStatus;

  members:
    SoftOneImplementationCorroborationMember[];

  supportingRepositories:
    string[];

  distinctRepositoryCount:
    number;

  reviewedRepositories:
    string[];

  distinctReviewedRepositoryCount:
    number;

  confidence:
    number;

  tags:
    string[];
}

export interface SoftOneImplementationCorroborationResult {
  capabilityKey: string;

  generatedAt: string;

  groups:
    SoftOneImplementationCorroborationGroup[];

  ungroupedEvidenceIds:
    string[];
}
