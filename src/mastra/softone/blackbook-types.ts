import type {
  SoftOneClaimKind,
  SoftOneEvidenceStatus,
} from "./evidence-types";

import type {
  SoftOneProductArea,
} from "./source-types";


export const SOFTONE_BLACKBOOK_SOURCE_ID =
  "OFFICIAL_SOFTONE_BLACKBOOK_3_5" as const;


export type SoftOneBlackBookExtractionKind =
  | "DOCUMENTED_BEHAVIOR"
  | "FUNCTION_SIGNATURE"
  | "METHOD_SIGNATURE"
  | "EVENT_SIGNATURE"
  | "COMMAND_SIGNATURE"
  | "SYSTEM_PARAMETER"
  | "CASE_STUDY_PATTERN"
  | "STRUCTURAL_REFERENCE"
  | "CONTEXTUAL_LITERAL";


export type SoftOneBlackBookPromotionPolicy =
  | "DIRECT_VERIFICATION_ELIGIBLE"
  | "DOCUMENTED_EXAMPLE_ONLY"
  | "REQUIRES_STRUCTURAL_CROSSCHECK"
  | "CONTEXT_ONLY";


export interface SoftOneBlackBookChapter {
  number: number;

  title: string;

  startPage: number;

  endPage: number;
}


export interface SoftOneBlackBookManifest {
  formatVersion: number;

  source: {
    sourceId:
      typeof SOFTONE_BLACKBOOK_SOURCE_ID;

    title: string;

    version: string;

    language: string;

    authority:
      "OFFICIAL_DOCUMENTATION";
  };

  chapters:
    SoftOneBlackBookChapter[];
}


export interface SoftOneBlackBookSection {
  chapter: number;

  chapterTitle: string;

  section: string;

  startPage: number;

  endPage: number;

  productAreas:
    SoftOneProductArea[];

  allowedExtractionKinds:
    SoftOneBlackBookExtractionKind[];
}


export interface SoftOneBlackBookCandidate {
  id: string;

  sourceId:
    typeof SOFTONE_BLACKBOOK_SOURCE_ID;

  chapter: number;

  chapterTitle: string;

  section: string;

  page: number;

  extractionKind:
    SoftOneBlackBookExtractionKind;

  claim: string;

  evidenceKind:
    SoftOneClaimKind;

  productAreas:
    SoftOneProductArea[];

  promotionPolicy:
    SoftOneBlackBookPromotionPolicy;

  recommendedStatus:
    SoftOneEvidenceStatus;

  symbol?: string;

  signature?: string;

  exampleText?: string;

  contextualValues?: Array<{
    name: string;

    value: string | number;

    reason:
      "EXAMPLE_LITERAL"
      | "TENANT_LITERAL"
      | "VERSION_LITERAL"
      | "UNKNOWN_CONTEXT";
  }>;

  verificationNotes?: string[];

  limitations?: string[];

  tags?: string[];
}
