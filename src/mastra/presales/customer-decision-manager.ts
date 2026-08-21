import {
  appDb,
} from "../db/postgres";

import type {
  CreateCustomerDecisionInput,
  CustomerDecision,
  CustomerDecisionValue,
} from "./types";


type CustomerDecisionRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  opportunity_id: string;
  proposal_id: string;
  proposal_revision_id: string;
  decision: CustomerDecisionValue;
  customer_contact_ref: string | null;
  comments: string | null;
  effective_at: string;
  created_at: string;
};


function mapCustomerDecision(
  row: CustomerDecisionRow,
): CustomerDecision {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    opportunityId:
      row.opportunity_id,
    proposalId:
      row.proposal_id,
    proposalRevisionId:
      row.proposal_revision_id,
    decision:
      row.decision,

    customerContactRef:
      row.customer_contact_ref ??
      undefined,

    comments:
      row.comments ??
      undefined,

    effectiveAt:
      row.effective_at,

    createdAt:
      row.created_at,
  };
}


export async function createCustomerDecision(
  input:
    CreateCustomerDecisionInput,
): Promise<CustomerDecision> {
  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const revision =
      await client.query<{
        revision_status: string;
        proposal_status: string;
      }>(
        `
          SELECT
            r.status AS revision_status,
            p.status AS proposal_status
          FROM app.proposal_revisions r
          JOIN app.proposals p
            ON p.id = r.proposal_id
          WHERE r.id = $1
            AND r.proposal_id = $2
            AND r.tenant_id = $3
            AND r.customer_id = $4
            AND r.opportunity_id = $5
          FOR UPDATE OF r, p
        `,
        [
          input.proposalRevisionId,
          input.proposalId,
          input.tenantId,
          input.customerId,
          input.opportunityId,
        ],
      );

    if (
      revision.rowCount !== 1
    ) {
      throw new Error(
        "Proposal revision ownership validation failed",
      );
    }

    if (
      input.decision ===
        "ACCEPTED" &&
      revision.rows[0]
        .revision_status !==
        "APPROVED"
    ) {
      throw new Error(
        "Customer cannot accept a proposal revision that is not internally APPROVED",
      );
    }

    if (
      ![
        "SENT",
        "AWAITING_CUSTOMER",
        "CHANGES_REQUESTED",
      ].includes(
        revision.rows[0]
          .proposal_status,
      ) &&
      input.decision !==
        "ON_HOLD"
    ) {
      throw new Error(
        `Customer decision is not allowed while proposal status is ${revision.rows[0].proposal_status}`,
      );
    }

    const result =
      await client.query<
        CustomerDecisionRow
      >(
        `
          INSERT INTO app.customer_decisions (
            tenant_id,
            customer_id,
            opportunity_id,
            proposal_id,
            proposal_revision_id,
            decision,
            customer_contact_ref,
            comments
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
          RETURNING
            id::text,
            tenant_id::text,
            customer_id::text,
            opportunity_id::text,
            proposal_id::text,
            proposal_revision_id::text,
            decision,
            customer_contact_ref,
            comments,
            effective_at::text,
            created_at::text
        `,
        [
          input.tenantId,
          input.customerId,
          input.opportunityId,
          input.proposalId,
          input.proposalRevisionId,
          input.decision,

          input.customerContactRef
            ?.trim() ||
            null,

          input.comments?.trim() ||
            null,
        ],
      );

    await client.query(
      `
        UPDATE app.proposals
        SET
          status = $2,
          updated_at = now()
        WHERE id = $1
      `,
      [
        input.proposalId,
        input.decision,
      ],
    );

    await client.query(
      `
        UPDATE app.opportunities
        SET
          status = $2,
          updated_at = now()
        WHERE id = $1
      `,
      [
        input.opportunityId,
        input.decision,
      ],
    );

    await client.query(
      "COMMIT",
    );

    return mapCustomerDecision(
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


export async function getLatestCustomerDecision(
  tenantId: string,
  opportunityId: string,
): Promise<CustomerDecision | null> {
  const result =
    await appDb.query<
      CustomerDecisionRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          proposal_id::text,
          proposal_revision_id::text,
          decision,
          customer_contact_ref,
          comments,
          effective_at::text,
          created_at::text
        FROM app.customer_decisions
        WHERE tenant_id = $1
          AND opportunity_id = $2
        ORDER BY
          effective_at DESC,
          created_at DESC
        LIMIT 1
      `,
      [
        tenantId,
        opportunityId,
      ],
    );

  const row =
    result.rows[0];

  return row
    ? mapCustomerDecision(row)
    : null;
}
