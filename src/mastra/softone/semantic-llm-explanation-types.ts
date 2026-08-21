export type SoftOneLlmStatementBasis =
  | "VERIFIED"
  | "DERIVED"
  | "DETERMINISTIC"
  | "CONTEXTUAL_INFERENCE";


export interface SoftOneLlmSemanticStatement {
  text: string;

  basis:
    SoftOneLlmStatementBasis;

  references?: string[];
}


export interface SoftOneLlmSemanticExplanation {
  summary: string;

  activeBehavior:
    SoftOneLlmSemanticStatement[];

  potentialBehavior:
    SoftOneLlmSemanticStatement[];

  businessInterpretation:
    SoftOneLlmSemanticStatement[];

  unresolved:
    Array<{
      construct: string;
      explanation: string;
    }>;

  risks:
    SoftOneLlmSemanticStatement[];

  inferredContext:
    Array<{
      statement: string;

      confidence:
        "LOW"
        | "MEDIUM"
        | "HIGH";

      evidence: string[];

      requiresVerification:
        true;
    }>;
}
