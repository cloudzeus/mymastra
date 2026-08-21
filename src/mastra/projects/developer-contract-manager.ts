import {
  appDb,
} from "../db/postgres";

import {
  getProject,
} from "./project-manager";

import {
  validateProjectDefinitionPackage,
} from "./project-definition-validator";

import {
  validateDeveloperWorkOrder,
} from "./developer-work-order-validator";

import type {
  ProjectDefinitionPackage,
  ProjectDefinitionStatus,
} from "./project-definition-types";

import type {
  DeveloperTaskType,
  DeveloperWorkOrder,
  DeveloperWorkOrderStatus,
} from "./developer-work-order-types";


export type PersistedProjectDefinition = {
  recordId: string;

  projectId: string;

  tenantId: string;

  version: number;

  status:
    ProjectDefinitionStatus;

  definition:
    ProjectDefinitionPackage;

  createdAt: string;

  updatedAt: string;
};


export type PersistedDeveloperWorkOrder = {
  recordId: string;

  projectId: string;

  projectDefinitionRecordId: string;

  projectDefinitionVersion: number;

  taskId: string;

  taskType:
    DeveloperTaskType;

  status:
    DeveloperWorkOrderStatus;

  workOrder:
    DeveloperWorkOrder;

  createdAt: string;

  updatedAt: string;
};


export type DeveloperExecutionContext = {
  workOrderRecordId: string;

  projectDefinitionRecordId: string;

  projectDefinition:
    ProjectDefinitionPackage;

  workOrder:
    DeveloperWorkOrder;
};


type ProjectDefinitionRow = {
  id: string;

  project_id: string;

  tenant_id: string;

  version: number;

  status:
    ProjectDefinitionStatus;

  definition:
    unknown;

  created_at: string;

  updated_at: string;
};


type DeveloperWorkOrderRow = {
  id: string;

  project_id: string;

  project_definition_id: string;

  project_definition_version: number;

  task_id: string;

  task_type:
    DeveloperTaskType;

  status:
    DeveloperWorkOrderStatus;

  work_order:
    unknown;

  created_at: string;

  updated_at: string;
};


function assertPlainObject(
  value: unknown,
  name: string,
): asserts value is Record<string, unknown> {
  if (
    typeof value !==
      "object" ||
    value ===
      null ||
    Array.isArray(
      value,
    )
  ) {
    throw new Error(
      `${name} is not a JSON object`,
    );
  }
}


function parseProjectDefinition(
  row:
    ProjectDefinitionRow,
): ProjectDefinitionPackage {
  assertPlainObject(
    row.definition,
    "Persisted ProjectDefinitionPackage",
  );


  const definition =
    row.definition as
      unknown as
      ProjectDefinitionPackage;


  if (
    definition.projectId !==
    row.project_id
  ) {
    throw new Error(
      `Persisted ProjectDefinitionPackage invariant violation: projectId mismatch for record=${row.id}`,
    );
  }


  if (
    definition.tenantId !==
    row.tenant_id
  ) {
    throw new Error(
      `Persisted ProjectDefinitionPackage invariant violation: tenantId mismatch for record=${row.id}`,
    );
  }


  if (
    definition.version !==
    row.version
  ) {
    throw new Error(
      `Persisted ProjectDefinitionPackage invariant violation: version mismatch for record=${row.id}`,
    );
  }


  if (
    definition.status !==
    row.status
  ) {
    throw new Error(
      `Persisted ProjectDefinitionPackage invariant violation: status mismatch for record=${row.id}`,
    );
  }


  const validation =
    validateProjectDefinitionPackage(
      definition,
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      [
        `Persisted ProjectDefinitionPackage is invalid: record=${row.id}`,
        ...validation.errors,
      ].join(
        ": ",
      ),
    );
  }


  return definition;
}


function mapProjectDefinition(
  row:
    ProjectDefinitionRow,
): PersistedProjectDefinition {
  return {
    recordId:
      row.id,

    projectId:
      row.project_id,

    tenantId:
      row.tenant_id,

    version:
      row.version,

    status:
      row.status,

    definition:
      parseProjectDefinition(
        row,
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


function parseDeveloperWorkOrder(
  row:
    DeveloperWorkOrderRow,
  definition:
    ProjectDefinitionPackage,
): DeveloperWorkOrder {
  assertPlainObject(
    row.work_order,
    "Persisted DeveloperWorkOrder",
  );


  const workOrder =
    row.work_order as
      unknown as
      DeveloperWorkOrder;


  if (
    workOrder.projectId !==
    row.project_id
  ) {
    throw new Error(
      `Persisted DeveloperWorkOrder invariant violation: projectId mismatch for record=${row.id}`,
    );
  }


  if (
    workOrder.projectDefinitionVersion !==
    row.project_definition_version
  ) {
    throw new Error(
      `Persisted DeveloperWorkOrder invariant violation: definition version mismatch for record=${row.id}`,
    );
  }


  if (
    workOrder.taskId !==
    row.task_id
  ) {
    throw new Error(
      `Persisted DeveloperWorkOrder invariant violation: taskId mismatch for record=${row.id}`,
    );
  }


  if (
    workOrder.taskType !==
    row.task_type
  ) {
    throw new Error(
      `Persisted DeveloperWorkOrder invariant violation: taskType mismatch for record=${row.id}`,
    );
  }


  if (
    workOrder.status !==
    row.status
  ) {
    throw new Error(
      `Persisted DeveloperWorkOrder invariant violation: status mismatch for record=${row.id}`,
    );
  }


  const validation =
    validateDeveloperWorkOrder(
      workOrder,
      definition,
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      [
        `Persisted DeveloperWorkOrder is invalid: record=${row.id}`,
        ...validation.errors,
      ].join(
        ": ",
      ),
    );
  }


  return workOrder;
}


export async function createProjectDefinition(
  definition:
    ProjectDefinitionPackage,
): Promise<PersistedProjectDefinition> {
  const validation =
    validateProjectDefinitionPackage(
      definition,
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      [
        "ProjectDefinitionPackage validation failed",
        ...validation.errors,
      ].join(
        ": ",
      ),
    );
  }


  const project =
    await getProject(
      definition.projectId,
    );


  if (
    project.tenantId !==
    definition.tenantId
  ) {
    throw new Error(
      "ProjectDefinitionPackage tenant does not match project tenant",
    );
  }


  const result =
    await appDb.query<
      ProjectDefinitionRow
    >(
      `
      INSERT INTO app.project_definitions (
        project_id,
        tenant_id,
        version,
        status,
        definition
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::jsonb
      )

      RETURNING
        id::text,
        project_id::text,
        tenant_id::text,
        version,
        status,
        definition,
        created_at::text,
        updated_at::text
      `,
      [
        definition.projectId,
        definition.tenantId,
        definition.version,
        definition.status,
        JSON.stringify(
          definition,
        ),
      ],
    );


  return mapProjectDefinition(
    result.rows[0],
  );
}


export async function getProjectDefinition(
  definitionRecordId: string,
): Promise<PersistedProjectDefinition> {
  if (
    !definitionRecordId?.trim()
  ) {
    throw new Error(
      "definitionRecordId is required",
    );
  }


  const result =
    await appDb.query<
      ProjectDefinitionRow
    >(
      `
      SELECT
        id::text,
        project_id::text,
        tenant_id::text,
        version,
        status,
        definition,
        created_at::text,
        updated_at::text
      FROM app.project_definitions
      WHERE id = $1
      LIMIT 1
      `,
      [
        definitionRecordId,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `ProjectDefinitionPackage not found: ${definitionRecordId}`,
    );
  }


  return mapProjectDefinition(
    row,
  );
}


export async function createDeveloperWorkOrder(
  input: {
    projectDefinitionRecordId: string;

    workOrder:
      DeveloperWorkOrder;
  },
): Promise<PersistedDeveloperWorkOrder> {
  const persistedDefinition =
    await getProjectDefinition(
      input.projectDefinitionRecordId,
    );


  const definition =
    persistedDefinition.definition;


  const validation =
    validateDeveloperWorkOrder(
      input.workOrder,
      definition,
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      [
        "DeveloperWorkOrder validation failed",
        ...validation.errors,
      ].join(
        ": ",
      ),
    );
  }


  if (
    input.workOrder.projectId !==
    persistedDefinition.projectId
  ) {
    throw new Error(
      "DeveloperWorkOrder project does not match persisted ProjectDefinitionPackage",
    );
  }


  if (
    input.workOrder.projectDefinitionVersion !==
    persistedDefinition.version
  ) {
    throw new Error(
      "DeveloperWorkOrder definition version does not match persisted ProjectDefinitionPackage",
    );
  }


  const result =
    await appDb.query<
      DeveloperWorkOrderRow
    >(
      `
      INSERT INTO app.developer_work_orders (
        project_id,
        project_definition_id,
        project_definition_version,
        task_id,
        task_type,
        status,
        work_order
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb
      )

      ON CONFLICT (
        project_id,
        task_id
      )
      DO UPDATE SET
        project_definition_id =
          EXCLUDED.project_definition_id,

        project_definition_version =
          EXCLUDED.project_definition_version,

        task_type =
          EXCLUDED.task_type,

        status =
          EXCLUDED.status,

        work_order =
          EXCLUDED.work_order,

        updated_at =
          now()

      RETURNING
        id::text,
        project_id::text,
        project_definition_id::text,
        project_definition_version,
        task_id,
        task_type,
        status,
        work_order,
        created_at::text,
        updated_at::text
      `,
      [
        input.workOrder.projectId,
        persistedDefinition.recordId,
        input.workOrder.projectDefinitionVersion,
        input.workOrder.taskId,
        input.workOrder.taskType,
        input.workOrder.status,
        JSON.stringify(
          input.workOrder,
        ),
      ],
    );


  const row =
    result.rows[0];


  return {
    recordId:
      row.id,

    projectId:
      row.project_id,

    projectDefinitionRecordId:
      row.project_definition_id,

    projectDefinitionVersion:
      row.project_definition_version,

    taskId:
      row.task_id,

    taskType:
      row.task_type,

    status:
      row.status,

    workOrder:
      parseDeveloperWorkOrder(
        row,
        definition,
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


export async function getDeveloperWorkOrder(
  workOrderRecordId: string,
): Promise<PersistedDeveloperWorkOrder> {
  if (
    !workOrderRecordId?.trim()
  ) {
    throw new Error(
      "workOrderRecordId is required",
    );
  }


  const result =
    await appDb.query<
      DeveloperWorkOrderRow
    >(
      `
      SELECT
        id::text,
        project_id::text,
        project_definition_id::text,
        project_definition_version,
        task_id,
        task_type,
        status,
        work_order,
        created_at::text,
        updated_at::text
      FROM app.developer_work_orders
      WHERE id = $1
      LIMIT 1
      `,
      [
        workOrderRecordId,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `DeveloperWorkOrder not found: ${workOrderRecordId}`,
    );
  }


  const persistedDefinition =
    await getProjectDefinition(
      row.project_definition_id,
    );


  if (
    persistedDefinition.projectId !==
    row.project_id ||
    persistedDefinition.version !==
    row.project_definition_version
  ) {
    throw new Error(
      `DeveloperWorkOrder definition binding invariant violation: record=${row.id}`,
    );
  }


  return {
    recordId:
      row.id,

    projectId:
      row.project_id,

    projectDefinitionRecordId:
      row.project_definition_id,

    projectDefinitionVersion:
      row.project_definition_version,

    taskId:
      row.task_id,

    taskType:
      row.task_type,

    status:
      row.status,

    workOrder:
      parseDeveloperWorkOrder(
        row,
        persistedDefinition.definition,
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


export async function loadDeveloperExecutionContext(
  workOrderRecordId: string,
): Promise<DeveloperExecutionContext> {
  const persistedWorkOrder =
    await getDeveloperWorkOrder(
      workOrderRecordId,
    );


  if (
    persistedWorkOrder.status !==
    "READY"
  ) {
    throw new Error(
      `Developer execution BLOCKED: persisted work order status is ${persistedWorkOrder.status}`,
    );
  }


  const persistedDefinition =
    await getProjectDefinition(
      persistedWorkOrder
        .projectDefinitionRecordId,
    );


  if (
    persistedDefinition.status !==
    "READY"
  ) {
    throw new Error(
      `Developer execution BLOCKED: persisted ProjectDefinitionPackage status is ${persistedDefinition.status}`,
    );
  }


  return {
    workOrderRecordId:
      persistedWorkOrder.recordId,

    projectDefinitionRecordId:
      persistedDefinition.recordId,

    projectDefinition:
      persistedDefinition.definition,

    workOrder:
      persistedWorkOrder.workOrder,
  };
}
