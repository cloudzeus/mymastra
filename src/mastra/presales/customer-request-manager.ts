import type {
  PoolClient,
} from "pg";

import {
  appDb,
} from "../db/postgres";

import {
  assertCustomerOwnership,
  insertOpportunity,
} from "./opportunity-manager";

import type {
  CreateCustomerRequestInput,
  CreateInitialOpportunityInput,
  CustomerRequest,
  InitialOpportunityResult,
} from "./types";


type CustomerRequestRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  opportunity_id: string;
  title: string;
  request_text: string;
  source_channel: string | null;
  budget_text: string | null;
  timeline_text: string | null;
  source_urls: unknown;
  attachments: unknown;
  metadata: unknown;
  created_at: string;
  updated_at: string;
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


function optionalText(
  value:
    string | undefined,
): string | null {
  if (
    value === undefined
  ) {
    return null;
  }

  return value.trim() || null;
}


function normalizeSourceUrls(
  value:
    string[] | undefined,
): string[] {
  if (!value) {
    return [];
  }

  const urls =
    value.map(
      item =>
        requireText(
          item,
          "source URL",
        ),
    );

  return [
    ...new Set(
      urls,
    ),
  ];
}


function normalizeAttachments(
  value:
    unknown[] | undefined,
): unknown[] {
  if (!value) {
    return [];
  }

  if (
    !Array.isArray(value)
  ) {
    throw new Error(
      "attachments must be an array",
    );
  }

  return value;
}


function normalizeMetadata(
  value:
    Record<string, unknown> |
    undefined,
): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (
    typeof value !==
      "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      "metadata must be an object",
    );
  }

  return value;
}


function mapCustomerRequest(
  row: CustomerRequestRow,
): CustomerRequest {
  const sourceUrls =
    Array.isArray(
      row.source_urls,
    )
      ? row.source_urls
          .filter(
            (
              item,
            ): item is string =>
              typeof item ===
              "string",
          )
      : [];

  const attachments =
    Array.isArray(
      row.attachments,
    )
      ? row.attachments
      : [];

  const metadata =
    typeof row.metadata ===
      "object" &&
    row.metadata !== null &&
    !Array.isArray(
      row.metadata,
    )
      ? row.metadata as
          Record<string, unknown>
      : {};

  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    customerId:
      row.customer_id,

    opportunityId:
      row.opportunity_id,

    title:
      row.title,

    requestText:
      row.request_text,

    sourceChannel:
      row.source_channel ??
      undefined,

    budgetText:
      row.budget_text ??
      undefined,

    timelineText:
      row.timeline_text ??
      undefined,

    sourceUrls,

    attachments,

    metadata,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


async function assertOpportunityOwnership(
  client: PoolClient,
  tenantId: string,
  customerId: string,
  opportunityId: string,
): Promise<void> {
  const result =
    await client.query(
      `
        SELECT
          id
        FROM app.opportunities
        WHERE id = $1
          AND tenant_id = $2
          AND customer_id = $3
        LIMIT 1
      `,
      [
        opportunityId,
        tenantId,
        customerId,
      ],
    );

  if (
    result.rowCount !== 1
  ) {
    throw new Error(
      `Opportunity does not belong to customer and tenant: opportunity=${opportunityId}`,
    );
  }
}


export async function insertCustomerRequest(
  client: PoolClient,
  input: CreateCustomerRequestInput,
): Promise<CustomerRequest> {
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

  const title =
    requireText(
      input.title,
      "Customer request title",
    );

  const requestText =
    requireText(
      input.requestText,
      "Customer request text",
    );

  await assertCustomerOwnership(
    client,
    tenantId,
    customerId,
  );

  await assertOpportunityOwnership(
    client,
    tenantId,
    customerId,
    opportunityId,
  );

  const result =
    await client.query<
      CustomerRequestRow
    >(
      `
        INSERT INTO app.customer_requests (
          tenant_id,
          customer_id,
          opportunity_id,
          title,
          request_text,
          source_channel,
          budget_text,
          timeline_text,
          source_urls,
          attachments,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::jsonb,
          $10::jsonb,
          $11::jsonb
        )
        RETURNING
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          title,
          request_text,
          source_channel,
          budget_text,
          timeline_text,
          source_urls,
          attachments,
          metadata,
          created_at::text,
          updated_at::text
      `,
      [
        tenantId,
        customerId,
        opportunityId,
        title,
        requestText,

        optionalText(
          input.sourceChannel,
        ),

        optionalText(
          input.budgetText,
        ),

        optionalText(
          input.timelineText,
        ),

        JSON.stringify(
          normalizeSourceUrls(
            input.sourceUrls,
          ),
        ),

        JSON.stringify(
          normalizeAttachments(
            input.attachments,
          ),
        ),

        JSON.stringify(
          normalizeMetadata(
            input.metadata,
          ),
        ),
      ],
    );

  return mapCustomerRequest(
    result.rows[0],
  );
}


export async function createCustomerRequest(
  input: CreateCustomerRequestInput,
): Promise<CustomerRequest> {
  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const request =
      await insertCustomerRequest(
        client,
        input,
      );

    await client.query(
      "COMMIT",
    );

    return request;
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


export async function createInitialOpportunity(
  input: CreateInitialOpportunityInput,
): Promise<InitialOpportunityResult> {
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

  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const opportunity =
      await insertOpportunity(
        client,
        {
          tenantId,
          customerId,

          code:
            input.opportunity.code,

          title:
            input.opportunity.title,

          description:
            input.opportunity.description,

          source:
            input.opportunity.source,

          expectedBudget:
            input.opportunity
              .expectedBudget,

          currency:
            input.opportunity.currency,

          targetDate:
            input.opportunity.targetDate,
        },
      );

    const request =
      await insertCustomerRequest(
        client,
        {
          tenantId,
          customerId,

          opportunityId:
            opportunity.id,

          title:
            input.request.title,

          requestText:
            input.request.requestText,

          sourceChannel:
            input.request.sourceChannel,

          budgetText:
            input.request.budgetText,

          timelineText:
            input.request.timelineText,

          sourceUrls:
            input.request.sourceUrls,

          attachments:
            input.request.attachments,

          metadata:
            input.request.metadata,
        },
      );

    await client.query(
      "COMMIT",
    );

    return {
      opportunity,
      request,
    };
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


export async function getCustomerRequest(
  tenantId: string,
  requestId: string,
): Promise<CustomerRequest> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedRequestId =
    requireText(
      requestId,
      "requestId",
    );

  const result =
    await appDb.query<
      CustomerRequestRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          title,
          request_text,
          source_channel,
          budget_text,
          timeline_text,
          source_urls,
          attachments,
          metadata,
          created_at::text,
          updated_at::text
        FROM app.customer_requests
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [
        normalizedRequestId,
        normalizedTenantId,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Customer request not found: ${normalizedRequestId}`,
    );
  }

  return mapCustomerRequest(
    row,
  );
}


export async function listOpportunityRequests(
  tenantId: string,
  opportunityId: string,
): Promise<CustomerRequest[]> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedOpportunityId =
    requireText(
      opportunityId,
      "opportunityId",
    );

  const result =
    await appDb.query<
      CustomerRequestRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          title,
          request_text,
          source_channel,
          budget_text,
          timeline_text,
          source_urls,
          attachments,
          metadata,
          created_at::text,
          updated_at::text
        FROM app.customer_requests
        WHERE tenant_id = $1
          AND opportunity_id = $2
        ORDER BY created_at ASC
      `,
      [
        normalizedTenantId,
        normalizedOpportunityId,
      ],
    );

  return result.rows.map(
    mapCustomerRequest,
  );
}
