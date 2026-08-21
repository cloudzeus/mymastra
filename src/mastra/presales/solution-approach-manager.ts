import {
  appDb,
} from "../db/postgres";

import type {
  CreateInitialSolutionApproachInput,
  InitialSolutionApproach,
  InitialSolutionApproachMetadata,
} from "./types";


type SolutionApproachRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  opportunity_id: string;
  version: number;
  approach_text: string;
  probable_scope: unknown;
  probable_technologies: unknown;
  assumptions: unknown;
  metadata: unknown;
  created_at: string;
};


function requireText(
  value: string,
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


function normalizeStringArray(
  value:
    string[] | undefined,
  fieldName: string,
): string[] {
  if (!value) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(
      `${fieldName} must be an array`,
    );
  }

  return [
    ...new Set(
      value.map(
        item =>
          requireText(
            item,
            fieldName,
          ),
      ),
    ),
  ];
}


function validateMetadata(
  metadata:
    InitialSolutionApproachMetadata,
): void {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    throw new Error(
      "Solution approach metadata must be an object",
    );
  }

  if (
    !metadata.engagementType
  ) {
    throw new Error(
      "metadata.engagementType is required",
    );
  }

  if (
    !Array.isArray(
      metadata.requiredCapabilities,
    )
  ) {
    throw new Error(
      "metadata.requiredCapabilities must be an array",
    );
  }

  if (
    !Array.isArray(
      metadata.optionalCapabilities,
    )
  ) {
    throw new Error(
      "metadata.optionalCapabilities must be an array",
    );
  }

  if (
    typeof metadata.developmentRequired !==
      "boolean"
  ) {
    throw new Error(
      "metadata.developmentRequired must be boolean",
    );
  }

  if (
    !metadata.repositoryMode
  ) {
    throw new Error(
      "metadata.repositoryMode is required",
    );
  }

  if (
    metadata.repositoryMode ===
      "EXISTING" &&
    metadata.repositoryUrl !== undefined &&
    !metadata.repositoryUrl.trim()
  ) {
    throw new Error(
      "metadata.repositoryUrl must not be blank",
    );
  }
}


function asStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is string =>
      typeof item === "string",
  );
}


function mapSolutionApproach(
  row: SolutionApproachRow,
): InitialSolutionApproach {
  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    customerId:
      row.customer_id,

    opportunityId:
      row.opportunity_id,

    version:
      row.version,

    approachText:
      row.approach_text,

    probableScope:
      asStringArray(
        row.probable_scope,
      ),

    probableTechnologies:
      asStringArray(
        row.probable_technologies,
      ),

    assumptions:
      asStringArray(
        row.assumptions,
      ),

    metadata:
      row.metadata as
        InitialSolutionApproachMetadata,

    createdAt:
      row.created_at,
  };
}


export async function createInitialSolutionApproach(
  input:
    CreateInitialSolutionApproachInput,
): Promise<InitialSolutionApproach> {
  const tenantId =
    requireText(
      input.tenantId,
      "tenantId",
    );

  const customerId =
    requireText(
      input.customerId,
      "customerId",
    );

  const opportunityId =
    requireText(
      input.opportunityId,
      "opportunityId",
    );

  const approachText =
    requireText(
      input.approachText,
      "approachText",
    );

  validateMetadata(
    input.metadata,
  );

  const probableScope =
    normalizeStringArray(
      input.probableScope,
      "probableScope",
    );

  const probableTechnologies =
    normalizeStringArray(
      input.probableTechnologies,
      "probableTechnologies",
    );

  const assumptions =
    normalizeStringArray(
      input.assumptions,
      "assumptions",
    );

  const client =
    await appDb.connect();

  try {
    await client.query("BEGIN");

    const opportunity =
      await client.query<{
        status: string;
      }>(
        `
          SELECT status
          FROM app.opportunities
          WHERE id = $1
            AND tenant_id = $2
            AND customer_id = $3
          FOR UPDATE
        `,
        [
          opportunityId,
          tenantId,
          customerId,
        ],
      );

    if (
      opportunity.rowCount !== 1
    ) {
      throw new Error(
        "Opportunity not found",
      );
    }

    const status =
      opportunity.rows[0].status;

    if (
      [
        "REJECTED",
        "EXPIRED",
        "CONVERTED_TO_PROJECT",
      ].includes(status)
    ) {
      throw new Error(
        `Cannot update solution approach for opportunity status ${status}`,
      );
    }

    /*
     * PRE-SALES CURRENT STATE
     *
     * There is intentionally no business versioning here.
     * The existing DB version column is kept temporarily
     * for schema compatibility only.
     */
    const existing =
      await client.query<{
        id: string;
      }>(
        `
          SELECT id::text
          FROM app.initial_solution_approaches
          WHERE opportunity_id = $1
            AND tenant_id = $2
            AND customer_id = $3
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [
          opportunityId,
          tenantId,
          customerId,
        ],
      );

    let result;

    if (
      existing.rowCount === 1
    ) {
      result =
        await client.query<
          SolutionApproachRow
        >(
          `
            UPDATE app.initial_solution_approaches
            SET
              approach_text = $2,
              probable_scope = $3::jsonb,
              probable_technologies = $4::jsonb,
              assumptions = $5::jsonb,
              metadata = $6::jsonb
            WHERE id = $1
            RETURNING
              id::text,
              tenant_id::text,
              customer_id::text,
              opportunity_id::text,
              version,
              approach_text,
              probable_scope,
              probable_technologies,
              assumptions,
              metadata,
              created_at::text
          `,
          [
            existing.rows[0].id,
            approachText,
            JSON.stringify(
              probableScope,
            ),
            JSON.stringify(
              probableTechnologies,
            ),
            JSON.stringify(
              assumptions,
            ),
            JSON.stringify(
              input.metadata,
            ),
          ],
        );
    }
    else {
      result =
        await client.query<
          SolutionApproachRow
        >(
          `
            INSERT INTO app.initial_solution_approaches (
              tenant_id,
              customer_id,
              opportunity_id,
              version,
              approach_text,
              probable_scope,
              probable_technologies,
              assumptions,
              metadata
            )
            VALUES (
              $1,
              $2,
              $3,
              1,
              $4,
              $5::jsonb,
              $6::jsonb,
              $7::jsonb,
              $8::jsonb
            )
            RETURNING
              id::text,
              tenant_id::text,
              customer_id::text,
              opportunity_id::text,
              version,
              approach_text,
              probable_scope,
              probable_technologies,
              assumptions,
              metadata,
              created_at::text
          `,
          [
            tenantId,
            customerId,
            opportunityId,
            approachText,
            JSON.stringify(
              probableScope,
            ),
            JSON.stringify(
              probableTechnologies,
            ),
            JSON.stringify(
              assumptions,
            ),
            JSON.stringify(
              input.metadata,
            ),
          ],
        );
    }

    await client.query(
      "COMMIT",
    );

    return mapSolutionApproach(
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

export async function getLatestInitialSolutionApproach(
  tenantId: string,
  opportunityId: string,
): Promise<InitialSolutionApproach | null> {
  const result =
    await appDb.query<
      SolutionApproachRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          version,
          approach_text,
          probable_scope,
          probable_technologies,
          assumptions,
          metadata,
          created_at::text
        FROM app.initial_solution_approaches
        WHERE tenant_id = $1
          AND opportunity_id = $2
        ORDER BY version DESC
        LIMIT 1
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

  const row =
    result.rows[0];

  return row
    ? mapSolutionApproach(row)
    : null;
}


export async function listInitialSolutionApproaches(
  tenantId: string,
  opportunityId: string,
): Promise<InitialSolutionApproach[]> {
  const result =
    await appDb.query<
      SolutionApproachRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          version,
          approach_text,
          probable_scope,
          probable_technologies,
          assumptions,
          metadata,
          created_at::text
        FROM app.initial_solution_approaches
        WHERE tenant_id = $1
          AND opportunity_id = $2
        ORDER BY version ASC
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
    mapSolutionApproach,
  );
}
