export type OpportunityStatus =
  | "DRAFT"
  | "QUALIFYING"
  | "ANALYSIS"
  | "CONCEPT_DESIGN"
  | "PROPOSAL_DRAFT"
  | "INTERNAL_REVIEW"
  | "READY_TO_SEND"
  | "SENT"
  | "AWAITING_CUSTOMER"
  | "CHANGES_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "ON_HOLD"
  | "EXPIRED"
  | "CONVERTED_TO_PROJECT";

export type Opportunity = {
  id: string;
  tenantId: string;
  customerId: string;
  code: string;
  title: string;
  description?: string;
  status: OpportunityStatus;
  source?: string;
  expectedBudget?: string;
  currency?: string;
  targetDate?: string;
  convertedProjectId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateOpportunityInput = {
  tenantId: string;
  customerId: string;
  code: string;
  title: string;
  description?: string;
  source?: string;
  expectedBudget?: number | string;
  currency?: string;
  targetDate?: string;
};

export type UpdateOpportunityDetailsInput = {
  title?: string;
  description?: string | null;
  source?: string | null;
  expectedBudget?: number | string | null;
  currency?: string | null;
  targetDate?: string | null;
};

export type CustomerRequest = {
  id: string;
  tenantId: string;
  customerId: string;
  opportunityId: string;
  title: string;
  requestText: string;
  sourceChannel?: string;
  budgetText?: string;
  timelineText?: string;
  sourceUrls: string[];
  attachments: unknown[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerRequestInput = {
  tenantId: string;
  customerId: string;
  opportunityId: string;
  title: string;
  requestText: string;
  sourceChannel?: string;
  budgetText?: string;
  timelineText?: string;
  sourceUrls?: string[];
  attachments?: unknown[];
  metadata?: Record<string, unknown>;
};

export type CreateInitialOpportunityInput = {
  tenantId: string;
  customerId: string;

  opportunity: {
    code: string;
    title: string;
    description?: string;
    source?: string;
    expectedBudget?: number | string;
    currency?: string;
    targetDate?: string;
  };

  request: {
    title: string;
    requestText: string;
    sourceChannel?: string;
    budgetText?: string;
    timelineText?: string;
    sourceUrls?: string[];
    attachments?: unknown[];
    metadata?: Record<string, unknown>;
  };
};

export type InitialOpportunityResult = {
  opportunity: Opportunity;
  request: CustomerRequest;
};

export type EngagementType =
  | "SEO"
  | "EXISTING_APPLICATION_CHANGE"
  | "GREENFIELD_APPLICATION"
  | "INTEGRATION"
  | "WEBSITE_REDESIGN"
  | "CONTENT"
  | "CONSULTING"
  | "MAINTENANCE"
  | "MIXED";

export type RepositoryMode =
  | "NONE"
  | "EXISTING"
  | "NEW";

export type PresalesCapability =
  | "TECHNICAL_ANALYSIS"
  | "RESEARCH_COMPETITOR"
  | "UI_UX_DESIGN"
  | "COPYWRITING"
  | "SEARCH_VISIBILITY"
  | "CONTENT_CREATION"
  | "DEVELOPMENT"
  | "INTEGRATION"
  | "DATA_MIGRATION"
  | "TESTING"
  | "DEPLOYMENT"
  | "DOCUMENTATION";

export type InitialSolutionApproachMetadata = {
  engagementType: EngagementType;

  requiredCapabilities:
    PresalesCapability[];

  optionalCapabilities:
    PresalesCapability[];

  developmentRequired:
    boolean;

  repositoryMode:
    RepositoryMode;

  existingSystem?:
    boolean;

  repositoryUrl?:
    string;

  customerProblemStatement?:
    string;

  presalesSourceIds?:
    string[];

  repositoryInspectionIds?:
    string[];

  existingSystemAnalysis?: {
    inspected: boolean;

    detectedStack?: string[];

    inspectedCommit?: string;

    verifiedIssues?: string[];

    suspectedIssues?: string[];

    knownConstraints?: string[];
  };

  notes?:
    string[];

  extra?:
    Record<string, unknown>;
};

export type InitialSolutionApproach = {
  id: string;

  tenantId: string;

  customerId: string;

  opportunityId: string;

  version: number;

  approachText: string;

  probableScope: string[];

  probableTechnologies: string[];

  assumptions: string[];

  metadata:
    InitialSolutionApproachMetadata;

  createdAt: string;
};

export type CreateInitialSolutionApproachInput = {
  tenantId: string;

  customerId: string;

  opportunityId: string;

  approachText: string;

  probableScope?: string[];

  probableTechnologies?: string[];

  assumptions?: string[];

  metadata:
    InitialSolutionApproachMetadata;
};

export type ProposalStatus =
  | "DRAFT"
  | "INTERNAL_REVIEW"
  | "APPROVED"
  | "SENT"
  | "AWAITING_CUSTOMER"
  | "CHANGES_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "ON_HOLD"
  | "EXPIRED"
  | "ARCHIVED";

export type ProposalRevisionStatus =
  | "DRAFT"
  | "INTERNAL_REVIEW"
  | "APPROVED"
  | "SUPERSEDED"
  | "REJECTED";

export type ProposalReviewDecision =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REJECTED";

export type CustomerDecisionValue =
  | "ACCEPTED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "ON_HOLD"
  | "EXPIRED";

export type Proposal = {
  id: string;

  tenantId: string;

  customerId: string;

  opportunityId: string;

  code: string;

  title: string;

  status:
    ProposalStatus;

  createdAt: string;

  updatedAt: string;
};

export type ProposalRevision = {
  id: string;

  tenantId: string;

  customerId: string;

  opportunityId: string;

  proposalId: string;

  version: number;

  status:
    ProposalRevisionStatus;

  content:
    Record<string, unknown>;

  sourceArtifactIds:
    string[];

  docxFileRef?: string;

  pdfFileRef?: string;

  createdAt: string;
};

export type ProposalReview = {
  id: string;

  tenantId: string;

  customerId: string;

  opportunityId: string;

  proposalId: string;

  proposalRevisionId: string;

  decision:
    ProposalReviewDecision;

  reviewerRef: string;

  comments?: string;

  createdAt: string;
};

export type CustomerDecision = {
  id: string;

  tenantId: string;

  customerId: string;

  opportunityId: string;

  proposalId: string;

  proposalRevisionId: string;

  decision:
    CustomerDecisionValue;

  customerContactRef?: string;

  comments?: string;

  effectiveAt: string;

  createdAt: string;
};

export type CreateProposalInput = {
  tenantId: string;

  customerId: string;

  opportunityId: string;

  code: string;

  title: string;
};

export type CreateProposalRevisionInput = {
  tenantId: string;

  customerId: string;

  opportunityId: string;

  proposalId: string;

  content:
    Record<string, unknown>;

  sourceArtifactIds?: string[];

  docxFileRef?: string;

  pdfFileRef?: string;
};

export type CreateProposalReviewInput = {
  tenantId: string;

  customerId: string;

  opportunityId: string;

  proposalId: string;

  proposalRevisionId: string;

  decision:
    ProposalReviewDecision;

  reviewerRef: string;

  comments?: string;
};

export type CreateCustomerDecisionInput = {
  tenantId: string;

  customerId: string;

  opportunityId: string;

  proposalId: string;

  proposalRevisionId: string;

  decision:
    CustomerDecisionValue;

  customerContactRef?: string;

  comments?: string;
};

export type ConvertOpportunityToProjectInput = {
  tenantId: string;

  opportunityId: string;

  projectCode: string;

  projectName: string;

  projectDescription?: string;
};

export type ConvertOpportunityToProjectResult = {
  projectId: string;

  opportunityId: string;

  acceptedCustomerDecisionId: string;

  projectDefinitionRequired: true;
};
