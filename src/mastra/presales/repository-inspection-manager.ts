import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../db/postgres";

import type {
  CreateRepositoryInspectionInput,
  RepositoryInspection,
  RepositoryInspectionFinding,
  RepositoryInspectionStatus,
} from "./repository-inspection-types";


type RepositoryInspectionRow = {
  id: string;

  tenant_id: string;
  customer_id: string;
  opportunity_id: string;

  presales_source_id: string;

  version: number;

  repository_url: string;

  requested_ref:
    string | null;

  resolved_ref:
    string | null;

  resolved_commit:
    string | null;

  detected_stack: string[];

  architecture: string[];

  modules: string[];

  integrations: string[];

  data_layer: string[];

  authentication: string[];

  deployment: string[];

  testing: string[];

  relevant_files: string[];

  findings:
    RepositoryInspectionFinding[];

  risks: string[];

  technical_debt: string[];

  limitations: string[];

  status:
    RepositoryInspectionStatus;

  created_at: string;
};


function requireText(
  value: string,
  name: string,
): string {
  const normalized =
    value?.trim();

  if (!normalized) {
    throw new Error(
      `${name} is required`,
    );
  }

  return normalized;
}


function mapInspection(
  row:
    RepositoryInspectionRow,
): RepositoryInspection {
  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    customerId:
      row.customer_id,

    opportunityId:
      row.opportunity_id,

    presalesSourceId:
      row.presales_source_id,

    version:
      Number(
        row.version,
      ),

    repositoryUrl:
      row.repository_url,

    requestedRef:
      row.requested_ref ??
      undefined,

    resolvedRef:
      row.resolved_ref ??
      undefined,

    resolvedCommit:
      row.resolved_commit ??
      undefined,

    detectedStack:
      row.detected_stack ?? [],

    architecture:
      row.architecture ?? [],

    modules:
      row.modules ?? [],

    integrations:
      row.integrations ?? [],

    dataLayer:
      row.data_layer ?? [],

    authentication:
      row.authentication ?? [],

    deployment:
      row.deployment ?? [],

    testing:
      row.testing ?? [],

    relevantFiles:
      row.relevant_files ?? [],

    findings:
      row.findings ?? [],

    risks:
      row.risks ?? [],

    technicalDebt:
      row.technical_debt ?? [],

    limitations:
      row.limitations ?? [],

    status:
      row.status,

    createdAt:
      row.created_at,
  };
}


function validateInspectionInput(
  input:
    CreateRepositoryInspectionInput,
): void {
  requireText(
    input.repositoryUrl,
    "repositoryUrl",
  );

  if (
    input.status === "READY" ||
    input.status === "PARTIAL"
  ) {
    requireText(
      input.resolvedRef ?? "",
      "resolvedRef",
    );

    requireText(
      input.resolvedCommit ?? "",
      "resolvedCommit",
    );
  }

  for (
    const finding
    of input.findings ?? []
  ) {
    requireText(
      finding.id,
      "finding.id",
    );

    requireText(
      finding.statement,
      "finding.statement",
    );

    for (
      const fileRef
      of finding.fileRefs
    ) {
      requireText(
        fileRef.path,
        "finding.fileRef.path",
      );
    }
  }
}


const RETURNING_COLUMNS = `
  id::text,
  tenant_id::text,
  customer_id::text,
  opportunity_id::text,
  presales_source_id::text,
  version,
  repository_url,
  requested_ref,
  resolved_ref,
  resolved_commit,
  detected_stack,
  architecture,
  modules,
  integrations,
  data_layer,
  authentication,
  deployment,
  testing,
  relevant_files,
  findings,
  risks,
  technical_debt,
  limitations,
  status,
  created_at::text
`;


export async function createRepositoryInspection(
  input:
    CreateRepositoryInspectionInput,
): Promise<RepositoryInspection> {
  validateInspectionInput(
    input,
  );

  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const source =
      await client.query<{
        source_type: string;
        repository_url:
          string | null;
        status: string;
      }>(
        `
          SELECT
            source_type,
            repository_url,
            status
          FROM app.presales_sources
          WHERE id = $1::uuid
            AND tenant_id = $2::uuid
            AND customer_id = $3::uuid
            AND opportunity_id = $4::uuid
          FOR UPDATE
        `,
        [
          requireText(
            input.presalesSourceId,
            "presalesSourceId",
          ),

          requireText(
            input.tenantId,
            "tenantId",
          ),

          requireText(
            input.customerId,
            "customerId",
          ),

          requireText(
            input.opportunityId,
            "opportunityId",
          ),
        ],
      );

    const sourceRow =
      source.rows[0];

    if (!sourceRow) {
      throw new Error(
        "Repository presales source ownership validation failed",
      );
    }

    if (
      sourceRow.source_type !==
        "REPOSITORY"
    ) {
      throw new Error(
        "Repository inspection requires a REPOSITORY presales source",
      );
    }

    if (
      sourceRow.status !==
        "READY"
    ) {
      throw new Error(
        `Repository presales source must be READY before inspection; status=${sourceRow.status}`,
      );
    }

    if (
      sourceRow.repository_url !==
        input.repositoryUrl.trim()
    ) {
      throw new Error(
        "Repository inspection URL does not match authoritative presales source",
      );
    }

    const versionResult =
      await client.query<{
        next_version: number;
      }>(
        `
          SELECT
            COALESCE(
              MAX(version),
              0
            ) + 1 AS next_version
          FROM app.repository_inspections
          WHERE presales_source_id =
            $1::uuid
        `,
        [
          input.presalesSourceId,
        ],
      );

    const version =
      Number(
        versionResult.rows[0]
          .next_version,
      );

    const result =
      await client.query<
        RepositoryInspectionRow
      >(
        `
          INSERT INTO app.repository_inspections (
            id,
            tenant_id,
            customer_id,
            opportunity_id,
            presales_source_id,
            version,
            repository_url,
            requested_ref,
            resolved_ref,
            resolved_commit,
            detected_stack,
            architecture,
            modules,
            integrations,
            data_layer,
            authentication,
            deployment,
            testing,
            relevant_files,
            findings,
            risks,
            technical_debt,
            limitations,
            status
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
            $11::jsonb,
            $12::jsonb,
            $13::jsonb,
            $14::jsonb,
            $15::jsonb,
            $16::jsonb,
            $17::jsonb,
            $18::jsonb,
            $19::jsonb,
            $20::jsonb,
            $21::jsonb,
            $22::jsonb,
            $23::jsonb,
            $24
          )
          RETURNING
            ${RETURNING_COLUMNS}
        `,
        [
          randomUUID(),

          input.tenantId,
          input.customerId,
          input.opportunityId,

          input.presalesSourceId,

          version,

          input.repositoryUrl.trim(),

          input.requestedRef?.trim() ||
            null,

          input.resolvedRef?.trim() ||
            null,

          input.resolvedCommit?.trim() ||
            null,

          JSON.stringify(
            input.detectedStack ?? [],
          ),

          JSON.stringify(
            input.architecture ?? [],
          ),

          JSON.stringify(
            input.modules ?? [],
          ),

          JSON.stringify(
            input.integrations ?? [],
          ),

          JSON.stringify(
            input.dataLayer ?? [],
          ),

          JSON.stringify(
            input.authentication ?? [],
          ),

          JSON.stringify(
            input.deployment ?? [],
          ),

          JSON.stringify(
            input.testing ?? [],
          ),

          JSON.stringify(
            input.relevantFiles ?? [],
          ),

          JSON.stringify(
            input.findings ?? [],
          ),

          JSON.stringify(
            input.risks ?? [],
          ),

          JSON.stringify(
            input.technicalDebt ?? [],
          ),

          JSON.stringify(
            input.limitations ?? [],
          ),

          input.status,
        ],
      );

    await client.query(
      "COMMIT",
    );

    return mapInspection(
      result.rows[0],
    );
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


export async function getLatestRepositoryInspection(
  tenantId: string,
  presalesSourceId: string,
): Promise<
  RepositoryInspection | null
> {
  const result =
    await appDb.query<
      RepositoryInspectionRow
    >(
      `
        SELECT
          ${RETURNING_COLUMNS}
        FROM app.repository_inspections
        WHERE tenant_id = $1::uuid
          AND presales_source_id =
            $2::uuid
        ORDER BY version DESC
        LIMIT 1
      `,
      [
        requireText(
          tenantId,
          "tenantId",
        ),

        requireText(
          presalesSourceId,
          "presalesSourceId",
        ),
      ],
    );

  const row =
    result.rows[0];

  return row
    ? mapInspection(
        row,
      )
    : null;
}


export async function listOpportunityRepositoryInspections(
  tenantId: string,
  opportunityId: string,
): Promise<
  RepositoryInspection[]
> {
  const result =
    await appDb.query<
      RepositoryInspectionRow
    >(
      `
        SELECT
          ${RETURNING_COLUMNS}
        FROM app.repository_inspections
        WHERE tenant_id = $1::uuid
          AND opportunity_id =
            $2::uuid
        ORDER BY
          created_at ASC,
          version ASC
      `,
      [
        requireText(
          tenantId,
          "tenantId",
        ),

        requireText(
          opportunityId,
          "opportunityId",
        ),
      ],
    );

  return result.rows.map(
    mapInspection,
  );
}
