import {
  getProjectExecutionPlan,
  getRunnableExecutionStages,
} from "./execution-plan-manager";

import {
  startExecutionStage,
  blockExecutionStage,
} from "./stage-runtime-manager";

import {
  resolveUpstreamStageOutputs,
} from "./stage-input-resolver";

import {
  commitExecutionStageResult,
} from "./stage-result-committer";

import type {
  ProjectExecutionStage,
} from "./types";

import type {
  OrchestratorPassResult,
  OrchestratorStageResult,
  StageExecutionHandlerRegistry,
  StageExecutionResult,
} from "./orchestrator-types";


function normalizeSingleResult(
  value:
    StageExecutionResult |
    StageExecutionResult[],
): StageExecutionResult {
  const values =
    Array.isArray(value)
      ? value
      : [value];


  /*
   * For now a stage produces exactly one
   * canonical output.
   *
   * This guarantees output binding + stage
   * completion can be committed atomically.
   *
   * Multi-output stages can be added later
   * with an atomic batch-output contract.
   */
  if (
    values.length !== 1
  ) {
    throw new Error(
      `Execution stage must return exactly one canonical output; received=${values.length}`,
    );
  }


  return values[0];
}


async function executeOneStage(
  tenantId: string,
  executionPlanId: string,
  stage: ProjectExecutionStage,
  handlers:
    StageExecutionHandlerRegistry,
): Promise<
  OrchestratorStageResult
> {
  try {
    const handler =
      handlers[
        stage.agentRole
      ];


    if (!handler) {
      throw new Error(
        `No execution handler registered for agentRole=${stage.agentRole}`,
      );
    }


    const plan =
      await getProjectExecutionPlan(
        tenantId,
        executionPlanId,
      );


    const upstreamOutputs =
      await resolveUpstreamStageOutputs(
        tenantId,
        executionPlanId,
        stage.id,
      );


    await startExecutionStage(
      tenantId,
      executionPlanId,
      stage.id,
    );


    const rawResult =
      await handler({
        tenantId,

        executionPlanId,

        projectId:
          plan.projectId,

        projectDefinitionId:
          plan.projectDefinitionId,

        projectDefinitionVersion:
          plan.projectDefinitionVersion,

        stage,

        upstreamOutputs,
      });


    const executionResult =
      normalizeSingleResult(
        rawResult,
      );


    const committed =
      await commitExecutionStageResult(
        tenantId,
        executionPlanId,
        stage.id,
        executionResult,
      );


    return {
      stageId:
        stage.id,

      stageKey:
        stage.stageKey,

      agentRole:
        stage.agentRole,

      success:
        true,

      waitingApproval:
        committed.stageStatus ===
          "WAITING_APPROVAL",

      outputs: [
        committed.output,
      ],

      reviewableDeliverable:
        committed.reviewableDeliverable,


      unlockedStageKeys:
        committed.unlockedStageKeys,
    };
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);


    /*
     * Missing handlers fail before start(),
     * therefore READY must also be blockable.
     *
     * Handler/output failures occur after
     * start(), therefore RUNNING is blockable.
     */
    try {
      await blockExecutionStage(
        tenantId,
        executionPlanId,
        stage.id,
      );
    }
    catch {
      /*
       * Preserve original execution error.
       *
       * If the stage had already transitioned
       * atomically to a terminal state there is
       * nothing left to block.
       */
    }


    return {
      stageId:
        stage.id,

      stageKey:
        stage.stageKey,

      agentRole:
        stage.agentRole,

      success:
        false,

      waitingApproval:
        false,

      outputs:
        [],

      unlockedStageKeys:
        [],

      error:
        message,
    };
  }
}


export async function runExecutionPlanPass(
  tenantId: string,
  executionPlanId: string,
  handlers:
    StageExecutionHandlerRegistry,
): Promise<
  OrchestratorPassResult
> {
  const initialRunnable =
    await getRunnableExecutionStages(
      tenantId,
      executionPlanId,
    );


  const stageResults =
    await Promise.all(
      initialRunnable.map(
        stage =>
          executeOneStage(
            tenantId,
            executionPlanId,
            stage,
            handlers,
          ),
      ),
    );


  const finalPlan =
    await getProjectExecutionPlan(
      tenantId,
      executionPlanId,
    );


  const remainingRunnable =
    finalPlan.stages.filter(
      stage =>
        stage.status ===
          "READY",
    );


  return {
    executionPlanId,

    runnableStageCount:
      initialRunnable.length,

    executedStageCount:
      stageResults.length,

    stageResults,

    finalPlanStatus:
      finalPlan.status,

    remainingRunnableStageKeys:
      remainingRunnable.map(
        stage =>
          stage.stageKey,
      ),
  };
}


export async function runExecutionPlanUntilPause(
  tenantId: string,
  executionPlanId: string,
  handlers:
    StageExecutionHandlerRegistry,
  options?: {
    maxPasses?: number;
  },
): Promise<{
  passes:
    OrchestratorPassResult[];

  finalPlanStatus: string;

  runnableStageKeys:
    string[];
}> {
  const maxPasses =
    options?.maxPasses ??
    50;


  if (
    !Number.isInteger(
      maxPasses,
    ) ||
    maxPasses < 1
  ) {
    throw new Error(
      "maxPasses must be a positive integer",
    );
  }


  const passes:
    OrchestratorPassResult[] =
    [];


  for (
    let passNumber = 1;
    passNumber <= maxPasses;
    passNumber += 1
  ) {
    const planBefore =
      await getProjectExecutionPlan(
        tenantId,
        executionPlanId,
      );


    if (
      planBefore.status ===
        "COMPLETED" ||
      planBefore.status ===
        "CANCELLED" ||
      planBefore.status ===
        "BLOCKED"
    ) {
      break;
    }


    const runnable =
      planBefore.stages.filter(
        stage =>
          stage.status ===
            "READY",
      );


    if (
      runnable.length === 0
    ) {
      break;
    }


    const pass =
      await runExecutionPlanPass(
        tenantId,
        executionPlanId,
        handlers,
      );


    passes.push(pass);


    if (
      pass.stageResults.some(
        result =>
          !result.success ||
          result.waitingApproval,
      )
    ) {
      break;
    }
  }


  const finalPlan =
    await getProjectExecutionPlan(
      tenantId,
      executionPlanId,
    );


  return {
    passes,

    finalPlanStatus:
      finalPlan.status,

    runnableStageKeys:
      finalPlan.stages
        .filter(
          stage =>
            stage.status ===
              "READY",
        )
        .map(
          stage =>
            stage.stageKey,
        ),
  };
}
