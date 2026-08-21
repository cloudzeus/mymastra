import type {
  PoolClient,
} from "pg";

import {
  appDb,
} from "../db/postgres";

import {
  validateSpecialistArtifact,
} from "./validator";

import type {
  SpecialistArtifactEnvelope,
  SpecialistArtifactStatus,
  SpecialistArtifactType,
  SpecialistRole,
} from "./types";


export type PersistedSpecialistArtifact<
  TPayload = unknown,
> = {
  recordId: string;

  artifact:
    SpecialistArtifactEnvelope<TPayload>;

  projectDefinitionRecordId?:
    string;

  projectDefinitionVersion?:
    number;
};


export type CreateSpecialistArtifactInput<
  TPayload = unknown,
> = {
  artifact:
    SpecialistArtifactEnvelope<TPayload>;

  projectDefinitionBinding?: {
    recordId: string;
    version: number;
  };
};


type SpecialistArtifactRow = {
  id: string;

  tenant_id: string;

  tenant_code: string | null;

  customer_id: string;

  opportunity_id:
    string | null;

  project_id:
    string | null;

  scope:
    "OPPORTUNITY" |
    "PROJECT";

  role:
    SpecialistRole;

  artifact_type:
    SpecialistArtifactType;

  version: number;

  status:
    SpecialistArtifactStatus;

  title: string;

  objective: string;

  source_artifact_ids:
    unknown;

  findings:
    unknown;

  recommendations:
    unknown;

  unresolved:
    unknown;

  blockers:
    unknown;

  provenance:
    unknown;

  payload:
    unknown;

  project_definition_id:
    string | null;

  project_definition_version:
    number | null;

  created_at: string;

  updated_at: string;
};


function requireText(
  value:
    string | undefined,
  fieldName: string,
): string {
  const normalized =
    value?.trim();

  if (!normalized) {
    throw new Error(
      `${fieldName} is required`,
    );
  }

  return normalized;
}


function assertUuid(
  value: string,
  fieldName: string,
): string {
  const normalized =
    requireText(
      value,
      fieldName,
    );

  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      `${fieldName} must be a UUID`,
    );
  }

  return normalized;
}


function asArray<T>(
  value: unknown,
  fieldName: string,
): T[] {
  if (
    !Array.isArray(value)
  ) {
    throw new Error(
      `Persisted specialist artifact ${fieldName} is not an array`,
    );
  }

  return value as T[];
}


function asObject(
  value: unknown,
  fieldName: string,
): Record<string, unknown> {
  if (
    typeof value !==
      "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `Persisted specialist artifact ${fieldName} is not an object`,
    );
  }

  return value as
    Record<string, unknown>;
}


async function resolveTenantCode(
  client: PoolClient,
  tenantId: string,
): Promise<string> {
  /*
   * to_jsonb(t)->>'code' deliberately avoids
   * coupling this module to the physical shape
   * of app.tenants beyond its primary id.
   */
  const result =
    await client.query<{
      tenant_code:
        string | null;
    }>(
      `
        SELECT
          to_jsonb(t)->>'code'
            AS tenant_code
        FROM app.tenants t
        WHERE t.id = $1
        LIMIT 1
      `,
      [
        tenantId,
      ],
    );

  const tenantCode =
    result.rows[0]
      ?.tenant_code
      ?.trim();

  if (!tenantCode) {
    throw new Error(
      `Tenant code could not be resolved for tenant=${tenantId}`,
    );
  }

  return tenantCode;
}


function mapArtifactRow(
  row:
    SpecialistArtifactRow,
): PersistedSpecialistArtifact {
  const tenantCode =
    requireText(
      row.tenant_code ??
        undefined,
      "Persisted tenantCode",
    );

  const common = {
    id:
      row.id,

    version:
      row.version,

    tenantId:
      row.tenant_id,

    tenantCode,

    role:
      row.role,

    artifactType:
      row.artifact_type,

    status:
      row.status,

    title:
      row.title,

    objective:
      row.objective,

    sourceArtifactIds:
      asArray<string>(
        row.source_artifact_ids,
        "sourceArtifactIds",
      ),

    findings:
      asArray(
        row.findings,
        "findings",
      ) as SpecialistArtifactEnvelope<unknown>["findings"],

    recommendations:
      asArray(
        row.recommendations,
        "recommendations",
      ) as SpecialistArtifactEnvelope<unknown>["recommendations"],

    unresolved:
      asArray(
        row.unresolved,
        "unresolved",
      ) as SpecialistArtifactEnvelope<unknown>["unresolved"],

    blockers:
      asArray(
        row.blockers,
        "blockers",
      ) as SpecialistArtifactEnvelope<unknown>["blockers"],

    provenance:
      asArray(
        row.provenance,
        "provenance",
      ) as SpecialistArtifactEnvelope<unknown>["provenance"],

    payload:
      asObject(
        row.payload,
        "payload",
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };

  const artifact:
    SpecialistArtifactEnvelope<unknown> =
    row.scope ===
      "OPPORTUNITY"
      ? {
          ...common,

          scope:
            "OPPORTUNITY",

          customerId:
            row.customer_id,

          opportunityId:
            requireText(
              row.opportunity_id ??
                undefined,
              "Persisted opportunityId",
            ),
        }
      : {
          ...common,

          scope:
            "PROJECT",

          customerId:
            row.customer_id,

          projectId:
            requireText(
              row.project_id ??
                undefined,
              "Persisted projectId",
            ),

          opportunityId:
            row.opportunity_id ??
            undefined,
        };

  const validation =
    validateSpecialistArtifact(
      artifact,
    );

  if (
    !validation.valid
  ) {
    throw new Error(
      [
        `Persisted specialist artifact is invalid: ${row.id}`,
        ...validation.errors,
      ].join(
        ": ",
      ),
    );
  }

  return {
    recordId:
      row.id,

    artifact,

    projectDefinitionRecordId:
      row.project_definition_id ??
      undefined,

    projectDefinitionVersion:
      row.project_definition_version ??
      undefined,
  };
}


const SELECT_COLUMNS = `
  a.id::text,
  a.tenant_id::text,

  to_jsonb(t)->>'code'
    AS tenant_code,

  a.customer_id::text,

  a.opportunity_id::text,

  a.project_id::text,

  a.scope,

  a.role,

  a.artifact_type,

  a.version,

  a.status,

  a.title,

  a.objective,

  a.source_artifact_ids,

  a.findings,

  a.recommendations,

  a.unresolved,

  a.blockers,

  a.provenance,

  a.payload,

  a.project_definition_id::text,

  a.project_definition_version,

  a.created_at::text,

  a.updated_at::text
`;


async function assertSourceArtifacts(
  client: PoolClient,
  tenantId: string,
  artifactId: string,
  sourceArtifactIds: string[],
): Promise<void> {
  if (
    sourceArtifactIds.length ===
      0
  ) {
    return;
  }

  const unique =
    [
      ...new Set(
        sourceArtifactIds,
      ),
    ];

  if (
    unique.length !==
      sourceArtifactIds.length
  ) {
    throw new Error(
      "sourceArtifactIds must not contain duplicates",
    );
  }

  for (
    const sourceId of unique
  ) {
    assertUuid(
      sourceId,
      "sourceArtifactId",
    );

    if (
      sourceId ===
        artifactId
    ) {
      throw new Error(
        "A specialist artifact cannot reference itself as a source artifact",
      );
    }
  }

  const result =
    await client.query<{
      id: string;
    }>(
      `
        SELECT
          id::text
        FROM app.specialist_artifacts
        WHERE tenant_id = $1
          AND id = ANY(
            $2::uuid[]
          )
      `,
      [
        tenantId,
        unique,
      ],
    );

  const found =
    new Set(
      result.rows.map(
        row =>
          row.id,
      ),
    );

  const missing =
    unique.filter(
      id =>
        !found.has(id),
    );

  if (
    missing.length >
      0
  ) {
    throw new Error(
      `Unknown source specialist artifacts: ${missing.join(", ")}`,
    );
  }
}


async function assertOpportunityOwnership(
  client: PoolClient,
  artifact:
    SpecialistArtifactEnvelope<unknown>,
): Promise<void> {
  if (
    artifact.scope !==
      "OPPORTUNITY"
  ) {
    return;
  }

  const result =
    await client.query(
      `
        SELECT 1
        FROM app.opportunities
        WHERE id = $1
          AND tenant_id = $2
          AND customer_id = $3
        FOR UPDATE
      `,
      [
        artifact.opportunityId,
        artifact.tenantId,
        artifact.customerId,
      ],
    );

  if (
    result.rowCount !== 1
  ) {
    throw new Error(
      "Specialist artifact opportunity ownership validation failed",
    );
  }
}


async function assertProjectOwnership(
  client: PoolClient,
  artifact:
    SpecialistArtifactEnvelope<unknown>,
): Promise<void> {
  if (
    artifact.scope !==
      "PROJECT"
  ) {
    return;
  }

  const result =
    await client.query(
      `
        SELECT 1
        FROM app.projects
        WHERE id = $1
          AND tenant_id = $2
        FOR UPDATE
      `,
      [
        artifact.projectId,
        artifact.tenantId,
      ],
    );

  if (
    result.rowCount !== 1
  ) {
    throw new Error(
      "Specialist artifact project ownership validation failed",
    );
  }

  /*
   * app.projects intentionally does not duplicate
   * customer_id. Therefore PROJECT specialist
   * artifacts must preserve the originating
   * opportunity so customer ownership can be
   * proven through the accepted opportunity ->
   * converted project relationship.
   */
  if (
    !artifact.opportunityId
  ) {
    throw new Error(
      "PROJECT specialist artifacts require originating opportunityId",
    );
  }

  const opportunity =
    await client.query(
      `
        SELECT 1
        FROM app.opportunities
        WHERE id = $1
          AND tenant_id = $2
          AND customer_id = $3
          AND converted_project_id = $4
        LIMIT 1
      `,
      [
        artifact.opportunityId,
        artifact.tenantId,
        artifact.customerId,
        artifact.projectId,
      ],
    );

  if (
    opportunity.rowCount !==
      1
  ) {
    throw new Error(
      "PROJECT specialist artifact opportunity/customer provenance does not match the converted project",
    );
  }
}


async function assertProjectDefinitionBinding(
  client: PoolClient,
  artifact:
    SpecialistArtifactEnvelope<unknown>,
  binding:
    CreateSpecialistArtifactInput["projectDefinitionBinding"],
): Promise<void> {
  if (
    artifact.scope ===
      "OPPORTUNITY"
  ) {
    if (binding) {
      throw new Error(
        "OPPORTUNITY specialist artifacts must not have a ProjectDefinition binding",
      );
    }

    return;
  }

  if (!binding) {
    throw new Error(
      "PROJECT specialist artifacts require projectDefinitionBinding",
    );
  }

  const definitionId =
    assertUuid(
      binding.recordId,
      "projectDefinitionBinding.recordId",
    );

  if (
    !Number.isInteger(
      binding.version,
    ) ||
    binding.version < 1
  ) {
    throw new Error(
      "projectDefinitionBinding.version must be a positive integer",
    );
  }

  const result =
    await client.query<{
      status: string;
    }>(
      `
        SELECT
          status
        FROM app.project_definitions
        WHERE id = $1
          AND project_id = $2
          AND version = $3
        LIMIT 1
      `,
      [
        definitionId,
        artifact.projectId,
        binding.version,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "ProjectDefinition binding does not exist for this project/version",
    );
  }

  if (
    row.status !==
      "READY"
  ) {
    throw new Error(
      `PROJECT specialist artifact requires READY ProjectDefinition; current status=${row.status}`,
    );
  }
}


async function assertNextVersion(
  client: PoolClient,
  artifact:
    SpecialistArtifactEnvelope<unknown>,
): Promise<void> {
  const result =
    artifact.scope ===
      "OPPORTUNITY"
      ? await client.query<{
          next_version: number;
        }>(
          `
            SELECT
              COALESCE(
                MAX(version),
                0
              ) + 1
                AS next_version
            FROM app.specialist_artifacts
            WHERE scope =
              'OPPORTUNITY'
              AND opportunity_id = $1
              AND artifact_type = $2
          `,
          [
            artifact.opportunityId,
            artifact.artifactType,
          ],
        )
      : await client.query<{
          next_version: number;
        }>(
          `
            SELECT
              COALESCE(
                MAX(version),
                0
              ) + 1
                AS next_version
            FROM app.specialist_artifacts
            WHERE scope =
              'PROJECT'
              AND project_id = $1
              AND artifact_type = $2
          `,
          [
            artifact.projectId,
            artifact.artifactType,
          ],
        );

  const expected =
    Number(
      result.rows[0]
        .next_version,
    );

  if (
    artifact.version !==
      expected
  ) {
    throw new Error(
      `Specialist artifact version must be ${expected}; received ${artifact.version}`,
    );
  }
}


export async function createSpecialistArtifact<
  TPayload = unknown,
>(
  input:
    CreateSpecialistArtifactInput<TPayload>,
): Promise<
  PersistedSpecialistArtifact<TPayload>
> {
  const artifact =
    input.artifact as
      SpecialistArtifactEnvelope<unknown>;

  assertUuid(
    artifact.id,
    "artifact.id",
  );

  const validation =
    validateSpecialistArtifact(
      artifact,
    );

  if (
    !validation.valid
  ) {
    throw new Error(
      [
        "Specialist artifact validation failed",
        ...validation.errors,
      ].join(
        ": ",
      ),
    );
  }

  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const canonicalTenantCode =
      await resolveTenantCode(
        client,
        artifact.tenantId,
      );

    if (
      canonicalTenantCode !==
        artifact.tenantCode
    ) {
      throw new Error(
        `Specialist artifact tenantCode mismatch: expected=${canonicalTenantCode} received=${artifact.tenantCode}`,
      );
    }

    await assertOpportunityOwnership(
      client,
      artifact,
    );

    await assertProjectOwnership(
      client,
      artifact,
    );

    await assertProjectDefinitionBinding(
      client,
      artifact,
      input.projectDefinitionBinding,
    );

    await assertSourceArtifacts(
      client,
      artifact.tenantId,
      artifact.id,
      artifact.sourceArtifactIds,
    );

    await assertNextVersion(
      client,
      artifact,
    );

    const projectDefinitionId =
      artifact.scope ===
        "PROJECT"
        ? input
            .projectDefinitionBinding!
            .recordId
        : null;

    const projectDefinitionVersion =
      artifact.scope ===
        "PROJECT"
        ? input
            .projectDefinitionBinding!
            .version
        : null;

    const result =
      await client.query<
        SpecialistArtifactRow
      >(
        `
          INSERT INTO app.specialist_artifacts (
            id,
            tenant_id,
            customer_id,
            opportunity_id,
            project_id,
            scope,
            role,
            artifact_type,
            version,
            status,
            title,
            objective,
            source_artifact_ids,
            findings,
            recommendations,
            unresolved,
            blockers,
            provenance,
            payload,
            project_definition_id,
            project_definition_version
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::uuid,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13::jsonb,
            $14::jsonb,
            $15::jsonb,
            $16::jsonb,
            $17::jsonb,
            $18::jsonb,
            $19::jsonb,
            $20::uuid,
            $21
          )
          RETURNING
            id::text,
            tenant_id::text,

            $22::text
              AS tenant_code,

            customer_id::text,
            opportunity_id::text,
            project_id::text,
            scope,
            role,
            artifact_type,
            version,
            status,
            title,
            objective,
            source_artifact_ids,
            findings,
            recommendations,
            unresolved,
            blockers,
            provenance,
            payload,
            project_definition_id::text,
            project_definition_version,
            created_at::text,
            updated_at::text
        `,
        [
          artifact.id,
          artifact.tenantId,
          artifact.customerId,

          artifact.scope ===
            "OPPORTUNITY"
            ? artifact.opportunityId
            : artifact.opportunityId ??
              null,

          artifact.scope ===
            "PROJECT"
            ? artifact.projectId
            : null,

          artifact.scope,
          artifact.role,
          artifact.artifactType,
          artifact.version,
          artifact.status,
          artifact.title.trim(),
          artifact.objective.trim(),

          JSON.stringify(
            artifact.sourceArtifactIds,
          ),

          JSON.stringify(
            artifact.findings,
          ),

          JSON.stringify(
            artifact.recommendations,
          ),

          JSON.stringify(
            artifact.unresolved,
          ),

          JSON.stringify(
            artifact.blockers,
          ),

          JSON.stringify(
            artifact.provenance,
          ),

          JSON.stringify(
            artifact.payload,
          ),

          projectDefinitionId,
          projectDefinitionVersion,
          canonicalTenantCode,
        ],
      );

    await client.query(
      "COMMIT",
    );

    return mapArtifactRow(
      result.rows[0],
    ) as
      PersistedSpecialistArtifact<TPayload>;
  }
  catch (error) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  }
  finally {
    client.release();
  }
}


export async function getSpecialistArtifact(
  tenantId: string,
  artifactId: string,
): Promise<
  PersistedSpecialistArtifact
> {
  const normalizedTenantId =
    assertUuid(
      tenantId,
      "tenantId",
    );

  const normalizedArtifactId =
    assertUuid(
      artifactId,
      "artifactId",
    );

  const result =
    await appDb.query<
      SpecialistArtifactRow
    >(
      `
        SELECT
          ${SELECT_COLUMNS}
        FROM app.specialist_artifacts a
        JOIN app.tenants t
          ON t.id = a.tenant_id
        WHERE a.id = $1
          AND a.tenant_id = $2
        LIMIT 1
      `,
      [
        normalizedArtifactId,
        normalizedTenantId,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Specialist artifact not found: ${normalizedArtifactId}`,
    );
  }

  return mapArtifactRow(
    row,
  );
}


export async function getLatestOpportunityArtifact(
  tenantId: string,
  opportunityId: string,
  artifactType:
    SpecialistArtifactType,
): Promise<
  PersistedSpecialistArtifact | null
> {
  const result =
    await appDb.query<
      SpecialistArtifactRow
    >(
      `
        SELECT
          ${SELECT_COLUMNS}
        FROM app.specialist_artifacts a
        JOIN app.tenants t
          ON t.id = a.tenant_id
        WHERE a.tenant_id = $1
          AND a.scope =
            'OPPORTUNITY'
          AND a.opportunity_id = $2
          AND a.artifact_type = $3
        ORDER BY
          a.version DESC
        LIMIT 1
      `,
      [
        assertUuid(
          tenantId,
          "tenantId",
        ),

        assertUuid(
          opportunityId,
          "opportunityId",
        ),

        artifactType,
      ],
    );

  const row =
    result.rows[0];

  return row
    ? mapArtifactRow(row)
    : null;
}


export async function getLatestProjectArtifact(
  tenantId: string,
  projectId: string,
  artifactType:
    SpecialistArtifactType,
): Promise<
  PersistedSpecialistArtifact | null
> {
  const result =
    await appDb.query<
      SpecialistArtifactRow
    >(
      `
        SELECT
          ${SELECT_COLUMNS}
        FROM app.specialist_artifacts a
        JOIN app.tenants t
          ON t.id = a.tenant_id
        WHERE a.tenant_id = $1
          AND a.scope =
            'PROJECT'
          AND a.project_id = $2
          AND a.artifact_type = $3
        ORDER BY
          a.version DESC
        LIMIT 1
      `,
      [
        assertUuid(
          tenantId,
          "tenantId",
        ),

        assertUuid(
          projectId,
          "projectId",
        ),

        artifactType,
      ],
    );

  const row =
    result.rows[0];

  return row
    ? mapArtifactRow(row)
    : null;
}


export async function listOpportunityArtifacts(
  tenantId: string,
  opportunityId: string,
): Promise<
  PersistedSpecialistArtifact[]
> {
  const result =
    await appDb.query<
      SpecialistArtifactRow
    >(
      `
        SELECT
          ${SELECT_COLUMNS}
        FROM app.specialist_artifacts a
        JOIN app.tenants t
          ON t.id = a.tenant_id
        WHERE a.tenant_id = $1
          AND a.scope =
            'OPPORTUNITY'
          AND a.opportunity_id = $2
        ORDER BY
          a.artifact_type,
          a.version ASC
      `,
      [
        assertUuid(
          tenantId,
          "tenantId",
        ),

        assertUuid(
          opportunityId,
          "opportunityId",
        ),
      ],
    );

  return result.rows.map(
    mapArtifactRow,
  );
}


export async function listProjectArtifacts(
  tenantId: string,
  projectId: string,
): Promise<
  PersistedSpecialistArtifact[]
> {
  const result =
    await appDb.query<
      SpecialistArtifactRow
    >(
      `
        SELECT
          ${SELECT_COLUMNS}
        FROM app.specialist_artifacts a
        JOIN app.tenants t
          ON t.id = a.tenant_id
        WHERE a.tenant_id = $1
          AND a.scope =
            'PROJECT'
          AND a.project_id = $2
        ORDER BY
          a.artifact_type,
          a.version ASC
      `,
      [
        assertUuid(
          tenantId,
          "tenantId",
        ),

        assertUuid(
          projectId,
          "projectId",
        ),
      ],
    );

  return result.rows.map(
    mapArtifactRow,
  );
}
