import type {
  SoftOneBlackBookExtractionKind,
  SoftOneBlackBookPromotionPolicy,
  SoftOneBlackBookSection,
} from "./blackbook-types";

import type {
  SoftOneClaimKind,
  SoftOneEvidenceStatus,
} from "./evidence-types";


export interface SoftOneBlackBookExtractionPolicy {
  extractionKind:
    SoftOneBlackBookExtractionKind;

  evidenceKind:
    SoftOneClaimKind;

  promotionPolicy:
    SoftOneBlackBookPromotionPolicy;

  recommendedStatus:
    SoftOneEvidenceStatus;
}


export const SOFTONE_BLACKBOOK_EXTRACTION_POLICIES:
  Record<
    SoftOneBlackBookExtractionKind,
    SoftOneBlackBookExtractionPolicy
  > = {

  DOCUMENTED_BEHAVIOR: {
    extractionKind:
      "DOCUMENTED_BEHAVIOR",

    evidenceKind:
      "OBJECT_BEHAVIOR",

    promotionPolicy:
      "DIRECT_VERIFICATION_ELIGIBLE",

    recommendedStatus:
      "VERIFIED",
  },

  FUNCTION_SIGNATURE: {
    extractionKind:
      "FUNCTION_SIGNATURE",

    evidenceKind:
      "FUNCTION",

    promotionPolicy:
      "DIRECT_VERIFICATION_ELIGIBLE",

    recommendedStatus:
      "VERIFIED",
  },

  METHOD_SIGNATURE: {
    extractionKind:
      "METHOD_SIGNATURE",

    evidenceKind:
      "FUNCTION",

    promotionPolicy:
      "DIRECT_VERIFICATION_ELIGIBLE",

    recommendedStatus:
      "VERIFIED",
  },

  EVENT_SIGNATURE: {
    extractionKind:
      "EVENT_SIGNATURE",

    evidenceKind:
      "EVENT_BEHAVIOR",

    promotionPolicy:
      "DIRECT_VERIFICATION_ELIGIBLE",

    recommendedStatus:
      "VERIFIED",
  },

  COMMAND_SIGNATURE: {
    extractionKind:
      "COMMAND_SIGNATURE",

    evidenceKind:
      "SCRIPT_PATTERN",

    promotionPolicy:
      "DIRECT_VERIFICATION_ELIGIBLE",

    recommendedStatus:
      "VERIFIED",
  },

  SYSTEM_PARAMETER: {
    extractionKind:
      "SYSTEM_PARAMETER",

    evidenceKind:
      "SCRIPT_PATTERN",

    promotionPolicy:
      "DIRECT_VERIFICATION_ELIGIBLE",

    recommendedStatus:
      "VERIFIED",
  },

  CASE_STUDY_PATTERN: {
    extractionKind:
      "CASE_STUDY_PATTERN",

    evidenceKind:
      "SCRIPT_PATTERN",

    promotionPolicy:
      "DOCUMENTED_EXAMPLE_ONLY",

    recommendedStatus:
      "DERIVED",
  },

  STRUCTURAL_REFERENCE: {
    extractionKind:
      "STRUCTURAL_REFERENCE",

    evidenceKind:
      "PHYSICAL_MAPPING",

    promotionPolicy:
      "REQUIRES_STRUCTURAL_CROSSCHECK",

    recommendedStatus:
      "DERIVED",
  },

  CONTEXTUAL_LITERAL: {
    extractionKind:
      "CONTEXTUAL_LITERAL",

    evidenceKind:
      "TENANT_RULE",

    promotionPolicy:
      "CONTEXT_ONLY",

    recommendedStatus:
      "HYPOTHESIS",
  },
};


export const SOFTONE_BLACKBOOK_PRIORITY_SECTIONS:
  readonly SoftOneBlackBookSection[] = [

  {
    chapter: 8,

    chapterTitle:
      "Scheduler & Messages",

    section:
      "Windows Scheduler",

    startPage: 252,

    endPage: 257,

    productAreas: [
      "CUSTOMIZATION",
      "SCRIPTING",
    ],

    allowedExtractionKinds: [
      "DOCUMENTED_BEHAVIOR",
      "COMMAND_SIGNATURE",
      "CONTEXTUAL_LITERAL",
    ],
  },

  {
    chapter: 8,

    chapterTitle:
      "Scheduler & Messages",

    section:
      "SoftOne Scheduler",

    startPage: 258,

    endPage: 261,

    productAreas: [
      "CUSTOMIZATION",
      "SCRIPTING",
    ],

    allowedExtractionKinds: [
      "DOCUMENTED_BEHAVIOR",
      "COMMAND_SIGNATURE",
      "CONTEXTUAL_LITERAL",
    ],
  },

  {
    chapter: 9,

    chapterTitle:
      "Form Scripts",

    section:
      "Object Methods",

    startPage: 272,

    endPage: 282,

    productAreas: [
      "SCRIPTING",
      "OBJECT_MODEL",
      "CUSTOMIZATION",
    ],

    allowedExtractionKinds: [
      "METHOD_SIGNATURE",
      "DOCUMENTED_BEHAVIOR",
      "CONTEXTUAL_LITERAL",
    ],
  },

  {
    chapter: 9,

    chapterTitle:
      "Form Scripts",

    section:
      "Object Functions",

    startPage: 283,

    endPage: 307,

    productAreas: [
      "SCRIPTING",
      "OBJECT_MODEL",
      "CUSTOMIZATION",
    ],

    allowedExtractionKinds: [
      "FUNCTION_SIGNATURE",
      "DOCUMENTED_BEHAVIOR",
      "CONTEXTUAL_LITERAL",
    ],
  },

  {
    chapter: 9,

    chapterTitle:
      "Form Scripts",

    section:
      "Dataset Methods and Functions",

    startPage: 308,

    endPage: 318,

    productAreas: [
      "SCRIPTING",
      "OBJECT_MODEL",
    ],

    allowedExtractionKinds: [
      "METHOD_SIGNATURE",
      "FUNCTION_SIGNATURE",
      "DOCUMENTED_BEHAVIOR",
    ],
  },

  {
    chapter: 9,

    chapterTitle:
      "Form Scripts",

    section:
      "Events",

    startPage: 319,

    endPage: 330,

    productAreas: [
      "SCRIPTING",
      "EVENTS",
      "FORM_DESIGN",
    ],

    allowedExtractionKinds: [
      "EVENT_SIGNATURE",
      "DOCUMENTED_BEHAVIOR",
    ],
  },

  {
    chapter: 9,

    chapterTitle:
      "Form Scripts",

    section:
      "Case Studies",

    startPage: 337,

    endPage: 366,

    productAreas: [
      "SCRIPTING",
      "CUSTOMIZATION",
    ],

    allowedExtractionKinds: [
      "CASE_STUDY_PATTERN",
      "CONTEXTUAL_LITERAL",
    ],
  },

  {
    chapter: 11,

    chapterTitle:
      "SoftOne Batch Script Language (SBSL)",

    section:
      "SBSL Core",

    startPage: 392,

    endPage: 450,

    productAreas: [
      "SCRIPTING",
      "CUSTOMIZATION",
      "SQL",
    ],

    allowedExtractionKinds: [
      "DOCUMENTED_BEHAVIOR",
      "FUNCTION_SIGNATURE",
      "COMMAND_SIGNATURE",
      "CONTEXTUAL_LITERAL",
    ],
  },

  {
    chapter: 12,

    chapterTitle:
      "Web Services",

    section:
      "Methods / API Calls",

    startPage: 466,

    endPage: 488,

    productAreas: [
      "WEB_SERVICES",
      "INTEGRATIONS",
      "OBJECT_MODEL",
    ],

    allowedExtractionKinds: [
      "FUNCTION_SIGNATURE",
      "DOCUMENTED_BEHAVIOR",
      "CONTEXTUAL_LITERAL",
    ],
  },
];
