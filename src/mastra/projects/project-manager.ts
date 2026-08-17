import {
  appDb,
} from "../db/postgres";

import type {
  CreateProjectInput,
  Project,
  ProjectStatus,
  UpdateProjectInput,
} from "./types";


type ProjectRow = {
  id: string;

  tenant_id: string;

  code: string;

  name: string;

  description:
    string | null;

  status:
    ProjectStatus;

  created_at: string;

  updated_at: string;
};


function mapProject(
  row:
    ProjectRow,
): Project {
  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    code:
      row.code,

    name:
      row.name,

    description:
      row.description ??
      undefined,

    status:
      row.status,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


async function assertActiveTenant(
  tenantId: string,
): Promise<void> {
  if (
    !tenantId?.trim()
  ) {
    throw new Error(
      "tenantId is required",
    );
  }


  const result =
    await appDb.query(
      `
      SELECT 1
      FROM app.tenants
      WHERE id = $1
        AND is_active = true
      LIMIT 1
      `,
      [
        tenantId,
      ],
    );


  if (
    result.rowCount !==
    1
  ) {
    throw new Error(
      `Active tenant not found: ${tenantId}`,
    );
  }
}


export async function createProject(
  input:
    CreateProjectInput,
): Promise<Project> {
  await assertActiveTenant(
    input.tenantId,
  );


  const code =
    input.code?.trim();


  if (!code) {
    throw new Error(
      "Project code is required",
    );
  }


  const name =
    input.name?.trim();


  if (!name) {
    throw new Error(
      "Project name is required",
    );
  }


  const result =
    await appDb.query<
      ProjectRow
    >(
      `
      INSERT INTO app.projects (
        tenant_id,
        code,
        name,
        description,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      RETURNING
        id::text,
        tenant_id::text,
        code,
        name,
        description,
        status,
        created_at::text,
        updated_at::text
      `,
      [
        input.tenantId,
        code,
        name,
        input.description?.trim() ||
          null,
        input.status ??
          "DRAFT",
      ],
    );


  return mapProject(
    result.rows[0],
  );
}


export async function getProject(
  projectId: string,
): Promise<Project> {
  if (
    !projectId?.trim()
  ) {
    throw new Error(
      "projectId is required",
    );
  }


  const result =
    await appDb.query<
      ProjectRow
    >(
      `
      SELECT
        id::text,
        tenant_id::text,
        code,
        name,
        description,
        status,
        created_at::text,
        updated_at::text
      FROM app.projects
      WHERE id = $1
      LIMIT 1
      `,
      [
        projectId,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `Project not found: ${projectId}`,
    );
  }


  return mapProject(
    row,
  );
}


export async function listTenantProjects(
  tenantId: string,
): Promise<Project[]> {
  if (
    !tenantId?.trim()
  ) {
    throw new Error(
      "tenantId is required",
    );
  }


  const result =
    await appDb.query<
      ProjectRow
    >(
      `
      SELECT
        id::text,
        tenant_id::text,
        code,
        name,
        description,
        status,
        created_at::text,
        updated_at::text
      FROM app.projects
      WHERE tenant_id = $1
      ORDER BY
        created_at DESC,
        code
      `,
      [
        tenantId,
      ],
    );


  return result.rows.map(
    mapProject,
  );
}


export async function updateProject(
  projectId: string,
  input:
    UpdateProjectInput,
): Promise<Project> {
  if (
    !projectId?.trim()
  ) {
    throw new Error(
      "projectId is required",
    );
  }


  if (
    input.name !==
      undefined &&
    !input.name.trim()
  ) {
    throw new Error(
      "Project name must not be blank",
    );
  }


  const result =
    await appDb.query<
      ProjectRow
    >(
      `
      UPDATE app.projects
      SET
        name =
          COALESCE(
            $2,
            name
          ),

        description =
          CASE
            WHEN $3::boolean
              THEN $4
            ELSE description
          END,

        status =
          COALESCE(
            $5,
            status
          ),

        updated_at =
          now()

      WHERE id = $1

      RETURNING
        id::text,
        tenant_id::text,
        code,
        name,
        description,
        status,
        created_at::text,
        updated_at::text
      `,
      [
        projectId,

        input.name !==
          undefined
          ? input.name.trim()
          : null,

        input.description !==
          undefined,

        input.description ===
          null
          ? null
          : input.description
              ?.trim() ||
            null,

        input.status ??
          null,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `Project not found: ${projectId}`,
    );
  }


  return mapProject(
    row,
  );
}
