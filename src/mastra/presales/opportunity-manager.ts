import type {
  PoolClient,
} from "pg";

import {
  appDb,
} from "../db/postgres";

import type {
  CreateOpportunityInput,
  Opportunity,
  OpportunityStatus,
  UpdateOpportunityDetailsInput,
} from "./types";


type OpportunityRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  code: string;
  title: string;
  description: string | null;
  status: OpportunityStatus;
  source: string | null;
  expected_budget: string | null;
  currency: string | null;
  target_date: string | null;
  converted_project_id: string | null;
  created_at: string;
  updated_at: string;
};


const STANDARD_TRANSITIONS:
  Record<
    OpportunityStatus,
    readonly OpportunityStatus[]
  > = {
    DRAFT: [
      "QUALIFYING",
      "ON_HOLD",
      "REJECTED",
    ],

    QUALIFYING: [
      "ANALYSIS",
      "ON_HOLD",
      "REJECTED",
    ],

    ANALYSIS: [
      "CONCEPT_DESIGN",
      "ON_HOLD",
      "REJECTED",
    ],

    CONCEPT_DESIGN: [
      "ANALYSIS",
      "PROPOSAL_DRAFT",
      "ON_HOLD",
      "REJECTED",
    ],

    PROPOSAL_DRAFT: [
      "CONCEPT_DESIGN",
      "INTERNAL_REVIEW",
      "ON_HOLD",
      "REJECTED",
    ],

    INTERNAL_REVIEW: [
      "PROPOSAL_DRAFT",
      "READY_TO_SEND",
      "ON_HOLD",
      "REJECTED",
    ],

    READY_TO_SEND: [
      "INTERNAL_REVIEW",
      "SENT",
      "ON_HOLD",
    ],

    SENT: [
      "AWAITING_CUSTOMER",
      "ON_HOLD",
    ],

    AWAITING_CUSTOMER: [
      "ON_HOLD",
      "REJECTED",
    ],

    CHANGES_REQUESTED: [
      "ANALYSIS",
      "CONCEPT_DESIGN",
      "PROPOSAL_DRAFT",
      "ON_HOLD",
    ],

    ACCEPTED: [],

    REJECTED: [],

    ON_HOLD: [
      "QUALIFYING",
      "ANALYSIS",
      "CONCEPT_DESIGN",
      "PROPOSAL_DRAFT",
      "INTERNAL_REVIEW",
      "READY_TO_SEND",
      "SENT",
      "AWAITING_CUSTOMER",
      "REJECTED",
    ],

    EXPIRED: [],

    CONVERTED_TO_PROJECT: [],
  };


const RESERVED_CUSTOMER_DECISION_STATUSES =
  new Set<OpportunityStatus>([
    "ACCEPTED",
    "CHANGES_REQUESTED",
    "EXPIRED",
  ]);


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
    string | null | undefined,
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  return value.trim() || null;
}


function normalizeCurrency(
  value:
    string | null | undefined,
): string | null {
  const normalized =
    optionalText(value);

  if (normalized === null) {
    return null;
  }

  const currency =
    normalized.toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      currency,
    )
  ) {
    throw new Error(
      "currency must be a three-letter ISO-style code",
    );
  }

  return currency;
}


function normalizeBudget(
  value:
    number | string | null | undefined,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const numeric =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(numeric) ||
    numeric < 0
  ) {
    throw new Error(
      "expectedBudget must be a non-negative number",
    );
  }

  return String(value);
}


function normalizeTargetDate(
  value:
    string | null | undefined,
): string | null {
  const normalized =
    optionalText(value);

  if (normalized === null) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "targetDate must use YYYY-MM-DD format",
    );
  }

  return normalized;
}


function mapOpportunity(
  row: OpportunityRow,
): Opportunity {
  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    customerId:
      row.customer_id,

    code:
      row.code,

    title:
      row.title,

    description:
      row.description ??
      undefined,

    status:
      row.status,

    source:
      row.source ??
      undefined,

    expectedBudget:
      row.expected_budget ??
      undefined,

    currency:
      row.currency ??
      undefined,

    targetDate:
      row.target_date ??
      undefined,

    convertedProjectId:
      row.converted_project_id ??
      undefined,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


export async function assertCustomerOwnership(
  client: PoolClient,
  tenantId: string,
  customerId: string,
): Promise<void> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedCustomerId =
    requireText(
      customerId,
      "customerId",
    );

  const result =
    await client.query(
      `
        SELECT
          id
        FROM app.customers
        WHERE id = $1
          AND tenant_id = $2
          AND status <> 'ARCHIVED'
        LIMIT 1
      `,
      [
        normalizedCustomerId,
        normalizedTenantId,
      ],
    );

  if (
    result.rowCount !== 1
  ) {
    throw new Error(
      `Customer not found for tenant: customer=${normalizedCustomerId} tenant=${normalizedTenantId}`,
    );
  }
}


export async function insertOpportunity(
  client: PoolClient,
  input: CreateOpportunityInput,
): Promise<Opportunity> {
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

  const code =
    requireText(
      input.code,
      "Opportunity code",
    );

  const title =
    requireText(
      input.title,
      "Opportunity title",
    );

  await assertCustomerOwnership(
    client,
    tenantId,
    customerId,
  );

  const result =
    await client.query<
      OpportunityRow
    >(
      `
        INSERT INTO app.opportunities (
          tenant_id,
          customer_id,
          code,
          title,
          description,
          status,
          source,
          expected_budget,
          currency,
          target_date
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'DRAFT',
          $6,
          $7,
          $8,
          $9
        )
        RETURNING
          id::text,
          tenant_id::text,
          customer_id::text,
          code,
          title,
          description,
          status,
          source,
          expected_budget::text,
          currency,
          target_date::text,
          converted_project_id::text,
          created_at::text,
          updated_at::text
      `,
      [
        tenantId,
        customerId,
        code,
        title,
        optionalText(
          input.description,
        ),
        optionalText(
          input.source,
        ),
        normalizeBudget(
          input.expectedBudget,
        ),
        normalizeCurrency(
          input.currency,
        ),
        normalizeTargetDate(
          input.targetDate,
        ),
      ],
    );

  return mapOpportunity(
    result.rows[0],
  );
}


export async function createOpportunity(
  input: CreateOpportunityInput,
): Promise<Opportunity> {
  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const opportunity =
      await insertOpportunity(
        client,
        input,
      );

    await client.query(
      "COMMIT",
    );

    return opportunity;
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


export async function getOpportunity(
  tenantId: string,
  opportunityId: string,
): Promise<Opportunity> {
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
      OpportunityRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          customer_id::text,
          code,
          title,
          description,
          status,
          source,
          expected_budget::text,
          currency,
          target_date::text,
          converted_project_id::text,
          created_at::text,
          updated_at::text
        FROM app.opportunities
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [
        normalizedOpportunityId,
        normalizedTenantId,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Opportunity not found: ${normalizedOpportunityId}`,
    );
  }

  return mapOpportunity(
    row,
  );
}


export async function listCustomerOpportunities(
  tenantId: string,
  customerId: string,
): Promise<Opportunity[]> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedCustomerId =
    requireText(
      customerId,
      "customerId",
    );

  const result =
    await appDb.query<
      OpportunityRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          customer_id::text,
          code,
          title,
          description,
          status,
          source,
          expected_budget::text,
          currency,
          target_date::text,
          converted_project_id::text,
          created_at::text,
          updated_at::text
        FROM app.opportunities
        WHERE tenant_id = $1
          AND customer_id = $2
        ORDER BY
          created_at DESC,
          code
      `,
      [
        normalizedTenantId,
        normalizedCustomerId,
      ],
    );

  return result.rows.map(
    mapOpportunity,
  );
}


export async function updateOpportunityDetails(
  tenantId: string,
  opportunityId: string,
  input: UpdateOpportunityDetailsInput,
): Promise<Opportunity> {
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

  if (
    input.title !== undefined &&
    !input.title.trim()
  ) {
    throw new Error(
      "Opportunity title must not be blank",
    );
  }

  const result =
    await appDb.query<
      OpportunityRow
    >(
      `
        UPDATE app.opportunities
        SET
          title =
            CASE
              WHEN $3::boolean
                THEN $4
              ELSE title
            END,

          description =
            CASE
              WHEN $5::boolean
                THEN $6
              ELSE description
            END,

          source =
            CASE
              WHEN $7::boolean
                THEN $8
              ELSE source
            END,

          expected_budget =
            CASE
              WHEN $9::boolean
                THEN $10::numeric
              ELSE expected_budget
            END,

          currency =
            CASE
              WHEN $11::boolean
                THEN $12
              ELSE currency
            END,

          target_date =
            CASE
              WHEN $13::boolean
                THEN $14::date
              ELSE target_date
            END,

          updated_at =
            now()

        WHERE id = $1
          AND tenant_id = $2

        RETURNING
          id::text,
          tenant_id::text,
          customer_id::text,
          code,
          title,
          description,
          status,
          source,
          expected_budget::text,
          currency,
          target_date::text,
          converted_project_id::text,
          created_at::text,
          updated_at::text
      `,
      [
        normalizedOpportunityId,
        normalizedTenantId,

        input.title !==
          undefined,

        input.title?.trim() ??
          null,

        input.description !==
          undefined,

        optionalText(
          input.description,
        ),

        input.source !==
          undefined,

        optionalText(
          input.source,
        ),

        input.expectedBudget !==
          undefined,

        normalizeBudget(
          input.expectedBudget,
        ),

        input.currency !==
          undefined,

        normalizeCurrency(
          input.currency,
        ),

        input.targetDate !==
          undefined,

        normalizeTargetDate(
          input.targetDate,
        ),
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Opportunity not found: ${normalizedOpportunityId}`,
    );
  }

  return mapOpportunity(
    row,
  );
}


export async function transitionOpportunityStatus(
  tenantId: string,
  opportunityId: string,
  targetStatus: OpportunityStatus,
): Promise<Opportunity> {
  const current =
    await getOpportunity(
      tenantId,
      opportunityId,
    );

  if (
    targetStatus ===
      "CONVERTED_TO_PROJECT"
  ) {
    throw new Error(
      "CONVERTED_TO_PROJECT is reserved for the project conversion service",
    );
  }

  if (
    RESERVED_CUSTOMER_DECISION_STATUSES.has(
      targetStatus,
    )
  ) {
    throw new Error(
      `${targetStatus} is reserved for the customer decision service`,
    );
  }

  const allowed =
    STANDARD_TRANSITIONS[
      current.status
    ];

  if (
    !allowed.includes(
      targetStatus,
    )
  ) {
    throw new Error(
      `Invalid opportunity transition: ${current.status} -> ${targetStatus}`,
    );
  }

  const result =
    await appDb.query<
      OpportunityRow
    >(
      `
        UPDATE app.opportunities
        SET
          status = $3,
          updated_at = now()
        WHERE id = $1
          AND tenant_id = $2
          AND status = $4
        RETURNING
          id::text,
          tenant_id::text,
          customer_id::text,
          code,
          title,
          description,
          status,
          source,
          expected_budget::text,
          currency,
          target_date::text,
          converted_project_id::text,
          created_at::text,
          updated_at::text
      `,
      [
        opportunityId,
        tenantId,
        targetStatus,
        current.status,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Opportunity status changed concurrently; reload and retry",
    );
  }

  return mapOpportunity(
    row,
  );
}
