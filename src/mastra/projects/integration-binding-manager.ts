import {
  appDb,
} from "../db/postgres";

import {
  resolveTenantIntegrationConnection,
} from "../integrations/connection-provider";

import type {
  IntegrationConnection,
  IntegrationEnvironment,
} from "../integrations/types";

import {
  getProject,
} from "./project-manager";

import type {
  CreateProjectIntegrationBindingInput,
  ProjectIntegrationBinding,
  UpdateProjectIntegrationBindingInput,
} from "./types";


type ProjectIntegrationBindingRow = {
  id: string;

  project_id: string;

  tenant_id: string;

  provider_id: string;

  provider_code: string;

  environment:
    IntegrationEnvironment;

  connection_id: string;

  is_active: boolean;

  created_at: string;

  updated_at: string;
};


function mapBinding(
  row:
    ProjectIntegrationBindingRow,
): ProjectIntegrationBinding {
  return {
    id:
      row.id,

    projectId:
      row.project_id,

    tenantId:
      row.tenant_id,

    providerId:
      row.provider_id,

    providerCode:
      row.provider_code,

    environment:
      row.environment,

    connectionId:
      row.connection_id,

    isActive:
      row.is_active,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


async function resolveProviderAndConnection(
  options: {
    tenantId: string;
    providerCode: string;
    environment:
      IntegrationEnvironment;
    connectionId: string;
  },
): Promise<{
  providerId: string;
}> {
  const result =
    await appDb.query<{
      provider_id: string;
    }>(
      `
      SELECT
        p.id::text AS provider_id
      FROM app.integration_connections ic
      INNER JOIN app.integration_providers p
        ON p.id = ic.provider_id
      WHERE ic.id = $1
        AND ic.tenant_id = $2
        AND p.code = $3
        AND ic.environment = $4
        AND ic.is_active = true
        AND p.is_active = true
      LIMIT 1
      `,
      [
        options.connectionId,
        options.tenantId,
        options.providerCode,
        options.environment,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `Project integration connection mismatch or inactive: connection=${options.connectionId} tenant=${options.tenantId} provider=${options.providerCode} environment=${options.environment}`,
    );
  }


  return {
    providerId:
      row.provider_id,
  };
}


export async function createProjectIntegrationBinding(
  input:
    CreateProjectIntegrationBindingInput,
): Promise<ProjectIntegrationBinding> {
  const project =
    await getProject(
      input.projectId,
    );


  if (
    !input.providerCode?.trim()
  ) {
    throw new Error(
      "providerCode is required",
    );
  }


  if (
    !input.connectionId?.trim()
  ) {
    throw new Error(
      "connectionId is required",
    );
  }


  const resolved =
    await resolveProviderAndConnection({
      tenantId:
        project.tenantId,

      providerCode:
        input.providerCode.trim(),

      environment:
        input.environment,

      connectionId:
        input.connectionId,
    });


  const result =
    await appDb.query<
      ProjectIntegrationBindingRow
    >(
      `
      INSERT INTO app.project_integration_bindings (
        project_id,
        tenant_id,
        provider_id,
        environment,
        connection_id,
        is_active
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        true
      )

      RETURNING
        id::text,
        project_id::text,
        tenant_id::text,
        provider_id::text,
        $6::text AS provider_code,
        environment,
        connection_id::text,
        is_active,
        created_at::text,
        updated_at::text
      `,
      [
        project.id,
        project.tenantId,
        resolved.providerId,
        input.environment,
        input.connectionId,
        input.providerCode.trim(),
      ],
    );


  return mapBinding(
    result.rows[0],
  );
}


export async function getProjectIntegrationBinding(
  projectId: string,
  providerCode: string,
  environment:
    IntegrationEnvironment,
): Promise<ProjectIntegrationBinding> {
  if (
    !projectId?.trim()
  ) {
    throw new Error(
      "projectId is required",
    );
  }


  if (
    !providerCode?.trim()
  ) {
    throw new Error(
      "providerCode is required",
    );
  }


  const result =
    await appDb.query<
      ProjectIntegrationBindingRow
    >(
      `
      SELECT
        pib.id::text,
        pib.project_id::text,
        pib.tenant_id::text,
        pib.provider_id::text,
        p.code AS provider_code,
        pib.environment,
        pib.connection_id::text,
        pib.is_active,
        pib.created_at::text,
        pib.updated_at::text
      FROM app.project_integration_bindings pib
      INNER JOIN app.integration_providers p
        ON p.id = pib.provider_id
      WHERE pib.project_id = $1
        AND p.code = $2
        AND pib.environment = $3
        AND pib.is_active = true
      LIMIT 2
      `,
      [
        projectId,
        providerCode.trim(),
        environment,
      ],
    );


  if (
    result.rowCount === 0
  ) {
    throw new Error(
      `Project integration binding BLOCKED: no active binding for project=${projectId} provider=${providerCode} environment=${environment}`,
    );
  }


  if (
    result.rowCount !== 1
  ) {
    throw new Error(
      `Project integration binding invariant violation: multiple active bindings for project=${projectId} provider=${providerCode} environment=${environment}`,
    );
  }


  return mapBinding(
    result.rows[0],
  );
}


export async function listProjectIntegrationBindings(
  projectId: string,
): Promise<ProjectIntegrationBinding[]> {
  if (
    !projectId?.trim()
  ) {
    throw new Error(
      "projectId is required",
    );
  }


  const result =
    await appDb.query<
      ProjectIntegrationBindingRow
    >(
      `
      SELECT
        pib.id::text,
        pib.project_id::text,
        pib.tenant_id::text,
        pib.provider_id::text,
        p.code AS provider_code,
        pib.environment,
        pib.connection_id::text,
        pib.is_active,
        pib.created_at::text,
        pib.updated_at::text
      FROM app.project_integration_bindings pib
      INNER JOIN app.integration_providers p
        ON p.id = pib.provider_id
      WHERE pib.project_id = $1
      ORDER BY
        p.code,
        pib.environment,
        pib.created_at
      `,
      [
        projectId,
      ],
    );


  return result.rows.map(
    mapBinding,
  );
}


export async function updateProjectIntegrationBinding(
  bindingId: string,
  input:
    UpdateProjectIntegrationBindingInput,
): Promise<ProjectIntegrationBinding> {
  if (
    !bindingId?.trim()
  ) {
    throw new Error(
      "bindingId is required",
    );
  }


  const existing =
    await appDb.query<
      ProjectIntegrationBindingRow
    >(
      `
      SELECT
        pib.id::text,
        pib.project_id::text,
        pib.tenant_id::text,
        pib.provider_id::text,
        p.code AS provider_code,
        pib.environment,
        pib.connection_id::text,
        pib.is_active,
        pib.created_at::text,
        pib.updated_at::text
      FROM app.project_integration_bindings pib
      INNER JOIN app.integration_providers p
        ON p.id = pib.provider_id
      WHERE pib.id = $1
      LIMIT 1
      `,
      [
        bindingId,
      ],
    );


  const current =
    existing.rows[0];


  if (!current) {
    throw new Error(
      `Project integration binding not found: ${bindingId}`,
    );
  }


  const nextConnectionId =
    input.connectionId ??
    current.connection_id;


  if (
    input.connectionId !==
    undefined
  ) {
    await resolveProviderAndConnection({
      tenantId:
        current.tenant_id,

      providerCode:
        current.provider_code,

      environment:
        current.environment,

      connectionId:
        nextConnectionId,
    });
  }


  const result =
    await appDb.query<
      ProjectIntegrationBindingRow
    >(
      `
      UPDATE app.project_integration_bindings pib
      SET
        connection_id = $2,

        is_active =
          COALESCE(
            $3,
            pib.is_active
          ),

        updated_at =
          now()

      FROM app.integration_providers p

      WHERE pib.id = $1
        AND p.id = pib.provider_id

      RETURNING
        pib.id::text,
        pib.project_id::text,
        pib.tenant_id::text,
        pib.provider_id::text,
        p.code AS provider_code,
        pib.environment,
        pib.connection_id::text,
        pib.is_active,
        pib.created_at::text,
        pib.updated_at::text
      `,
      [
        bindingId,
        nextConnectionId,
        input.isActive ??
          null,
      ],
    );


  return mapBinding(
    result.rows[0],
  );
}


export async function resolveProjectIntegrationConnection(
  projectId: string,
  providerCode: string,
  environment:
    IntegrationEnvironment,
): Promise<IntegrationConnection> {
  const project =
    await getProject(
      projectId,
    );


  const binding =
    await getProjectIntegrationBinding(
      projectId,
      providerCode,
      environment,
    );


  /*
   * Project execution never falls back to tenant defaults.
   * The explicit project binding is the execution authority.
   */
  return resolveTenantIntegrationConnection({
    tenantId:
      project.tenantId,

    providerCode:
      binding.providerCode,

    environment:
      binding.environment,

    connectionId:
      binding.connectionId,
  });
}
