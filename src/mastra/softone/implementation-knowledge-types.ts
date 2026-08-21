import type {
  SoftOneClaimKind,
} from "./evidence-types";

import type {
  SoftOneProductArea,
} from "./source-types";

export interface SoftOneImplementationSource {
  candidateId: string;
  capabilityKey: string;

  repositoryId: string;
  repositoryOwner: string;
  repositoryName: string;
  repositoryUrl: string;

  commit: string;

  implementationName: string;
  sourceFiles: string[];
}

export interface SoftOneImplementationExtractedClaim {
  claim: string;

  kind: SoftOneClaimKind;

  productAreas: SoftOneProductArea[];

  conditions?: string[];

  limitations?: string[];

  tags?: string[];

  evidenceFiles: string[];

  confidence:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
}

export interface SoftOneImplementationExtractionResult {
  source:
    SoftOneImplementationSource;

  claims:
    SoftOneImplementationExtractedClaim[];

  skippedFiles:
    Array<{
      path: string;
      reason: string;
    }>;
}
