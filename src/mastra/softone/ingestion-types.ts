import type {
  SoftOneEvidenceRecord,
} from "./evidence-types";

export type SoftOneIngestionStatus =
  | "CANDIDATE"
  | "ACCEPTED"
  | "REJECTED"
  | "NEEDS_REVIEW";

export type SoftOneIngestionSource =
  | "SOFT1_GMAIL"
  | "BLACKBOOK"
  | "WIKI"
  | "OFFICIAL_VIDEO"
  | "GITHUB"
  | "MANUAL";

export interface SoftOneIngestionCandidate {
  id: string;

  source:
    SoftOneIngestionSource;

  sourceKey: string;

  sourceFingerprint: string;

  status:
    SoftOneIngestionStatus;

  evidence:
    SoftOneEvidenceRecord;

  rawReference?: {
    subject?: string;
    author?: string;
    publishedAt?: string;

    gmailUrl?: string;
    groupUrl?: string;

    page?: number;
    section?: string;
    timestampSeconds?: number;
  };

  extraction: {
    automatic: boolean;

    confidence:
      | "HIGH"
      | "MEDIUM"
      | "LOW";

    reason: string[];

    requiresHumanReview:
      boolean;
  };

  createdAt:
    string;
}
