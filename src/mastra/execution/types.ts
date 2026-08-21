import type {
  SpecialistArtifactType,
  SpecialistRole,
} from "../specialists/types";


export type ProjectExecutionPlanStatus =
  | "DRAFT"
  | "READY"
  | "ACTIVE"
  | "BLOCKED"
  | "COMPLETED"
  | "CANCELLED";


export type ProjectExecutionStageStatus =
  | "PENDING"
  | "READY"
  | "RUNNING"
  | "WAITING_APPROVAL"
  | "COMPLETED"
  | "BLOCKED"
  | "SKIPPED";


export type ProjectExecutionKind =
  | "SPECIALIST_ARTIFACT"
  | "DEVELOPER_WORK_ORDER";


export type ProjectExecutionAgentRole =
  | SpecialistRole
  | "DEVELOPER";


export type ProjectExecutionStageDefinition =
  | {
      stageKey: string;

      agentRole:
        SpecialistRole;

      executionKind:
        "SPECIALIST_ARTIFACT";

      expectedArtifactType:
        SpecialistArtifactType;

      required?: boolean;

      approvalRequired?: boolean;

      configuration?:
        Record<string, unknown>;
    }
  | {
      stageKey: string;

      agentRole:
        "DEVELOPER";

      executionKind:
        "DEVELOPER_WORK_ORDER";

      expectedArtifactType?: never;

      required?: boolean;

      approvalRequired?: boolean;

      configuration?:
        Record<string, unknown>;
    };


export type ProjectExecutionDependencyDefinition = {
  stageKey: string;

  dependsOnStageKey: string;
};


export type CreateProjectExecutionPlanInput = {
  tenantId: string;

  projectId: string;

  projectDefinitionId: string;

  projectDefinitionVersion: number;

  stages:
    ProjectExecutionStageDefinition[];

  dependencies?:
    ProjectExecutionDependencyDefinition[];
};


export type ProjectExecutionStage = {
  id: string;

  executionPlanId: string;

  projectId: string;

  stageKey: string;

  agentRole:
    ProjectExecutionAgentRole;

  executionKind:
    ProjectExecutionKind;

  expectedArtifactType?:
    SpecialistArtifactType;

  required: boolean;

  approvalRequired: boolean;

  status:
    ProjectExecutionStageStatus;

  configuration:
    Record<string, unknown>;

  createdAt: string;

  updatedAt: string;
};


export type ProjectExecutionStageDependency = {
  executionPlanId: string;

  stageId: string;

  dependsOnStageId: string;

  stageKey: string;

  dependsOnStageKey: string;
};


export type ProjectExecutionPlan = {
  id: string;

  tenantId: string;

  projectId: string;

  projectDefinitionId: string;

  projectDefinitionVersion: number;

  version: number;

  status:
    ProjectExecutionPlanStatus;

  stages:
    ProjectExecutionStage[];

  dependencies:
    ProjectExecutionStageDependency[];

  createdAt: string;

  updatedAt: string;
};


export type ProjectExecutionStageOutput =
  | {
      id: string;

      executionPlanId: string;

      stageId: string;

      projectId: string;

      outputKind:
        "SPECIALIST_ARTIFACT";

      specialistArtifactId:
        string;

      sequence: number;

      createdAt: string;
    }
  | {
      id: string;

      executionPlanId: string;

      stageId: string;

      projectId: string;

      outputKind:
        "DEVELOPER_WORK_ORDER";

      developerWorkOrderId:
        string;

      sequence: number;

      createdAt: string;
    };


export type AttachSpecialistArtifactOutputInput = {
  tenantId: string;

  executionPlanId: string;

  stageId: string;

  specialistArtifactId: string;
};


export type AttachDeveloperWorkOrderOutputInput = {
  tenantId: string;

  executionPlanId: string;

  stageId: string;

  developerWorkOrderId: string;
};
