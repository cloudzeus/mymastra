export type QaOverallStatus =
  | "PASS"
  | "PASS_WITH_WARNINGS"
  | "PASS_WITH_MANUAL_VALIDATION_REQUIRED"
  | "FAIL"
  | "BLOCKED";


export type QaAssertionStatus =
  | "PASS"
  | "FAIL"
  | "BLOCKED"
  | "NOT_APPLICABLE";


export type QaAssertion = {
  id: string;

  subject: string;

  status:
    QaAssertionStatus;

  evidenceFiles:
    string[];

  notes:
    string[];
};


export type QaIssueSeverity =
  | "BLOCKER"
  | "HIGH"
  | "MEDIUM"
  | "LOW";


export type QaIssueCategory =
  | "IMPLEMENTATION"
  | "OPENAPI"
  | "POSTMAN"
  | "DOCUMENTATION"
  | "SOFTONE"
  | "SECURITY"
  | "TEST";


export type QaIssue = {
  id: string;

  severity:
    QaIssueSeverity;

  category:
    QaIssueCategory;

  description: string;

  evidenceFiles:
    string[];

  remediation:
    string[];
};


export type QaManualValidation = {
  type:
    | "SOFTONE_ADVANCED_JAVASCRIPT"
    | "LIVE_PROVIDER"
    | "DEPLOYMENT"
    | "OTHER";

  status:
    | "PENDING_ADMIN_TEST"
    | "PENDING_INTEGRATION_TEST"
    | "NOT_REQUIRED";

  instructions:
    string[];
};


export type QaReportPackage = {
  collectionName: string;

  developerWorkOrderId: string;

  status:
    QaOverallStatus;

  staticVerification: {
    implementationVsOpenApi:
      QaAssertion;

    openApiVsPostman:
      QaAssertion;

    documentationVsImplementation:
      QaAssertion;

    softOneMappingVsAdvancedJavaScript:
      QaAssertion;

    acceptanceCriteria:
      QaAssertion[];
  };

  issues:
    QaIssue[];

  documentationChanges:
    string[];

  manualValidation:
    QaManualValidation[];

  evidenceFiles:
    string[];

  generatedArtifacts: {
    qaReportPath: string;

    testResultsPath: string;

    documentationPaths:
      string[];
  };
};
