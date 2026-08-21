import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../db/postgres";

import type {
  CreatePresalesSourceInput,
  PresalesSource,
  PresalesSourceStatus,
  PresalesSourceType,
  RepositoryProvider,
} from "./presales-source-types";


type PresalesSourceRow = {
  id: string;

  tenant_id: string;
  customer_id: string;
  opportunity_id: string;

  source_type:
    PresalesSourceType;

  title: string;

  reference:
    string | null;

  repository_provider:
    RepositoryProvider | null;

  repository_url:
    string | null;

  requested_ref:
    string | null;

  access_mode:
    "READ_ONLY";

  metadata:
    Record<string, unknown>;

  status:
    PresalesSourceStatus;

  created_at: string;
  updated_at: string;
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


function mapPresalesSource(
  row: PresalesSourceRow,
): PresalesSource {
  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    customerId:
      row.customer_id,

    opportunityId:
      row.opportunity_id,

    sourceType:
      row.source_type,

    title:
      row.title,

    reference:
      row.reference ??
      undefined,

    repositoryProvider:
      row.repository_provider ??
      undefined,

    repositoryUrl:
      row.repository_url ??
      undefined,

    requestedRef:
      row.requested_ref ??
      undefined,

    accessMode:
      row.access_mode,

    metadata:
      row.metadata ?? {},

    status:
      row.status,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


function validateRepositorySource(
  input:
    CreatePresalesSourceInput,
): void {
  if (
    input.sourceType !==
      "REPOSITORY"
  ) {
    return;
  }

  if (
    !input.repositoryProvider
  ) {
    throw new Error(
      "Repository presales source requires repositoryProvider",
    );
  }

  requireText(
    input.repositoryUrl ?? "",
    "repositoryUrl",
  );
}


export async function createPresalesSource(
  input:
    CreatePresalesSourceInput,
): Promise<PresalesSource> {
  validateRepositorySource(
    input,
  );

  const id =
    randomUUID();

  const result =
    await appDb.query<
      PresalesSourceRow
    >(
      `
        INSERT INTO app.presales_sources (
          id,
          tenant_id,
          customer_id,
          opportunity_id,
          source_type,
          title,
          reference,
          repository_provider,
          repository_url,
          requested_ref,
          access_mode,
          metadata,
          status
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          'READ_ONLY',
          $11::jsonb,
          $12
        )
        RETURNING
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          source_type,
          title,
          reference,
          repository_provider,
          repository_url,
          requested_ref,
          access_mode,
          metadata,
          status,
          created_at::text,
          updated_at::text
      `,
      [
        id,

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

        input.sourceType,

        requireText(
          input.title,
          "title",
        ),

        input.reference?.trim() ||
          null,

        input.repositoryProvider ??
          null,

        input.repositoryUrl?.trim() ||
          null,

        input.requestedRef?.trim() ||
          null,

        JSON.stringify(
          input.metadata ?? {},
        ),

        input.status ??
          "PENDING",
      ],
    );

  return mapPresalesSource(
    result.rows[0],
  );
}


export async function getPresalesSource(
  tenantId: string,
  sourceId: string,
): Promise<PresalesSource> {
  const result =
    await appDb.query<
      PresalesSourceRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          source_type,
          title,
          reference,
          repository_provider,
          repository_url,
          requested_ref,
          access_mode,
          metadata,
          status,
          created_at::text,
          updated_at::text
        FROM app.presales_sources
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
        LIMIT 1
      `,
      [
        requireText(
          sourceId,
          "sourceId",
        ),

        requireText(
          tenantId,
          "tenantId",
        ),
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Presales source not found: ${sourceId}`,
    );
  }

  return mapPresalesSource(
    row,
  );
}


export async function listOpportunityPresalesSources(
  tenantId: string,
  opportunityId: string,
): Promise<PresalesSource[]> {
  const result =
    await appDb.query<
      PresalesSourceRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          source_type,
          title,
          reference,
          repository_provider,
          repository_url,
          requested_ref,
          access_mode,
          metadata,
          status,
          created_at::text,
          updated_at::text
        FROM app.presales_sources
        WHERE tenant_id = $1::uuid
          AND opportunity_id = $2::uuid
        ORDER BY created_at ASC
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
    mapPresalesSource,
  );
}


export async function updatePresalesSourceStatus(
  tenantId: string,
  sourceId: string,
  status:
    PresalesSourceStatus,
): Promise<PresalesSource> {
  const result =
    await appDb.query<
      PresalesSourceRow
    >(
      `
        UPDATE app.presales_sources
        SET
          status = $3,
          updated_at = now()
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
        RETURNING
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          source_type,
          title,
          reference,
          repository_provider,
          repository_url,
          requested_ref,
          access_mode,
          metadata,
          status,
          created_at::text,
          updated_at::text
      `,
      [
        requireText(
          sourceId,
          "sourceId",
        ),

        requireText(
          tenantId,
          "tenantId",
        ),

        status,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Presales source not found: ${sourceId}`,
    );
  }

  return mapPresalesSource(
    row,
  );
}
