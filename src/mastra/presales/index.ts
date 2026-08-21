export * from "./types";

export {
  createOpportunity,
  getOpportunity,
  listCustomerOpportunities,
  updateOpportunityDetails,
  transitionOpportunityStatus,
} from "./opportunity-manager";

export {
  createCustomerRequest,
  createInitialOpportunity,
  getCustomerRequest,
  listOpportunityRequests,
} from "./customer-request-manager";

export {
  createInitialSolutionApproach,
  getLatestInitialSolutionApproach,
  listInitialSolutionApproaches,
} from "./solution-approach-manager";

export {
  createProposal,
  createProposalRevision,
  submitProposalRevisionForReview,
  createProposalReview,
  markProposalSent,
  markProposalAwaitingCustomer,
  getLatestProposalRevision,
} from "./proposal-manager";

export {
  createCustomerDecision,
  getLatestCustomerDecision,
} from "./customer-decision-manager";

export {
  convertAcceptedOpportunityToProject,
} from "./project-conversion-manager";


export * from "./presales-source-types";
export * from "./repository-inspection-types";

export {
  createPresalesSource,
  getPresalesSource,
  listOpportunityPresalesSources,
  updatePresalesSourceStatus,
} from "./presales-source-manager";

export {
  createRepositoryInspection,
  getLatestRepositoryInspection,
  listOpportunityRepositoryInspections,
} from "./repository-inspection-manager";

export * from "./presales-repository-workspace-types";

export {
  buildPresalesRepositoryWorkspacePath,
  createPresalesRepositoryWorkspace,
  getPresalesRepositoryWorkspace,
  provisionPresalesRepository,
} from "./presales-repository-workspace-manager";

export type {
  RunPresalesBusinessTechnicalAnalysisInput,
  RunPresalesBusinessTechnicalAnalysisResult,
} from "./analyst-execution-service";

export {
  runPresalesBusinessTechnicalAnalysis,
} from "./analyst-execution-service";

export * from "./customer-proposal-generator";
