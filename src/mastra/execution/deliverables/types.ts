import type {
  ProjectExecutionAgentRole,
} from "../types";


export type ExecutionDeliverableRevisionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED";


export type ExecutionReviewDecision =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REJECTED";


export type RequestedChangeSeverity =
  | "REQUIRED"
  | "RECOMMENDED";


export type RequestedChange = {
  id: string;

  severity:
    RequestedChangeSeverity;

  target: string;

  description: string;
};


export type RequestedChangeResolutionStatus =
  | "RESOLVED"
  | "PARTIALLY_RESOLVED"
  | "BLOCKED";


export type RequestedChangeResolution = {
  requestedChangeId: string;

  status:
    RequestedChangeResolutionStatus;

  evidence:
    string[];

  notes?: string;
};


export type ExecutionDeliverable = {
  id: string;

  tenantId: string;

  projectId: string;

  executionPlanId: string;

  stageId: string;

  agentRole:
    ProjectExecutionAgentRole;

  deliverableType: string;

  createdAt: string;

  updatedAt: string;
};


export type ExecutionDeliverableRevision = {
  id: string;

  deliverableId: string;

  version: number;

  status:
    ExecutionDeliverableRevisionStatus;

  revisionOfId?: string;

  contentSnapshot:
    Record<string, unknown>;

  outputKind?: string;

  specialistArtifactId?: string;

  developerWorkOrderId?: string;

  changeResolution:
    RequestedChangeResolution[];

  createdAt: string;
};


export type ExecutionDeliverableReview = {
  id: string;

  tenantId: string;

  projectId: string;

  executionPlanId: string;

  stageId: string;

  deliverableId: string;

  deliverableRevisionId: string;

  decision:
    ExecutionReviewDecision;

  reviewerRef: string;

  summary?: string;

  requestedChanges:
    RequestedChange[];

  createdAt: string;
};


export type CreateExecutionDeliverableRevisionInput = {
  tenantId: string;

  projectId: string;

  executionPlanId: string;

  stageId: string;

  agentRole:
    ProjectExecutionAgentRole;

  deliverableType: string;

  contentSnapshot:
    Record<string, unknown>;

  outputKind?: string;

  specialistArtifactId?: string;

  developerWorkOrderId?: string;

  revisionOfId?: string;

  changeResolution?:
    RequestedChangeResolution[];
};


export type ReviewExecutionDeliverableInput = {
  tenantId: string;

  executionPlanId: string;

  stageId: string;

  deliverableRevisionId: string;

  reviewerRef: string;

  decision:
    ExecutionReviewDecision;

  summary?: string;

  requestedChanges?:
    RequestedChange[];
};
