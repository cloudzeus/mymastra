import type {
  ProjectExecutionAgentRole,
  ProjectExecutionStage,
  ProjectExecutionStageOutput,
} from "./types";


export type StageExecutionContext = {
  tenantId: string;

  executionPlanId: string;

  projectId: string;

  projectDefinitionId: string;

  projectDefinitionVersion: number;

  stage: ProjectExecutionStage;

  upstreamOutputs:
    ProjectExecutionStageOutput[];
};


export type SpecialistStageExecutionResult = {
  kind:
    "SPECIALIST_ARTIFACT";

  specialistArtifactId:
    string;
};


export type DeveloperStageExecutionResult = {
  kind:
    "DEVELOPER_WORK_ORDER";

  developerWorkOrderId:
    string;
};


export type StageExecutionResult =
  | SpecialistStageExecutionResult
  | DeveloperStageExecutionResult;


export type StageExecutionHandler = (
  context: StageExecutionContext,
) => Promise<
  StageExecutionResult |
  StageExecutionResult[]
>;


export type StageExecutionHandlerRegistry =
  Partial<
    Record<
      ProjectExecutionAgentRole,
      StageExecutionHandler
    >
  >;


export type OrchestratorStageResult = {
  stageId: string;

  stageKey: string;

  agentRole:
    ProjectExecutionAgentRole;

  success: boolean;

  waitingApproval: boolean;

  outputs:
    ProjectExecutionStageOutput[];

  reviewableDeliverable?: {
    deliverableId: string;
    deliverableRevisionId: string;
    deliverableType: string;
    version: number;
  };


  unlockedStageKeys:
    string[];

  error?: string;
};


export type OrchestratorPassResult = {
  executionPlanId: string;

  runnableStageCount: number;

  executedStageCount: number;

  stageResults:
    OrchestratorStageResult[];

  finalPlanStatus: string;

  remainingRunnableStageKeys:
    string[];
};
