import {
  appDb,
} from "../db/postgres";

import type {
  CreateProposalInput,
  CreateProposalRevisionInput,
  CreateProposalReviewInput,
  Proposal,
  ProposalRevision,
  ProposalReview,
  ProposalStatus,
  ProposalRevisionStatus,
  ProposalReviewDecision,
} from "./types";


type ProposalRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  opportunity_id: string;
  code: string;
  title: string;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
};


type RevisionRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  opportunity_id: string;
  proposal_id: string;
  version: number;
  status: ProposalRevisionStatus;
  content: unknown;
  source_artifact_ids: unknown;
  docx_file_ref: string | null;
  pdf_file_ref: string | null;
  created_at: string;
};


type ReviewRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  opportunity_id: string;
  proposal_id: string;
  proposal_revision_id: string;
  decision: ProposalReviewDecision;
  reviewer_ref: string;
  comments: string | null;
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


function mapProposal(
  row: ProposalRow,
): Proposal {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    opportunityId:
      row.opportunity_id,
    code: row.code,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


function mapRevision(
  row: RevisionRow,
): ProposalRevision {
  const content =
    typeof row.content ===
      "object" &&
    row.content !== null &&
    !Array.isArray(
      row.content,
    )
      ? row.content as
          Record<string, unknown>
      : {};

  const sourceArtifactIds =
    Array.isArray(
      row.source_artifact_ids,
    )
      ? row.source_artifact_ids
          .filter(
            (
              item,
            ): item is string =>
              typeof item ===
              "string",
          )
      : [];

  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    opportunityId:
      row.opportunity_id,
    proposalId:
      row.proposal_id,
    version: row.version,
    status: row.status,
    content,
    sourceArtifactIds,

    docxFileRef:
      row.docx_file_ref ??
      undefined,

    pdfFileRef:
      row.pdf_file_ref ??
      undefined,

    createdAt:
      row.created_at,
  };
}


function mapReview(
  row: ReviewRow,
): ProposalReview {
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
    reviewerRef:
      row.reviewer_ref,
    comments:
      row.comments ??
      undefined,
    createdAt:
      row.created_at,
  };
}


export async function createProposal(
  input:
    CreateProposalInput,
): Promise<Proposal> {
  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

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
          requireText(
            input.opportunityId,
            "opportunityId",
          ),

          requireText(
            input.tenantId,
            "tenantId",
          ),

          requireText(
            input.customerId,
            "customerId",
          ),
        ],
      );

    if (
      opportunity.rowCount !== 1
    ) {
      throw new Error(
        "Opportunity ownership validation failed",
      );
    }

    if (
      [
        "REJECTED",
        "EXPIRED",
        "CONVERTED_TO_PROJECT",
      ].includes(
        opportunity.rows[0]
          .status,
      )
    ) {
      throw new Error(
        `Cannot create proposal for opportunity status ${opportunity.rows[0].status}`,
      );
    }

    const result =
      await client.query<
        ProposalRow
      >(
        `
          INSERT INTO app.proposals (
            tenant_id,
            customer_id,
            opportunity_id,
            code,
            title,
            status
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'DRAFT'
          )
          RETURNING
            id::text,
            tenant_id::text,
            customer_id::text,
            opportunity_id::text,
            code,
            title,
            status,
            created_at::text,
            updated_at::text
        `,
        [
          input.tenantId.trim(),
          input.customerId.trim(),
          input.opportunityId.trim(),

          requireText(
            input.code,
            "Proposal code",
          ),

          requireText(
            input.title,
            "Proposal title",
          ),
        ],
      );

    await client.query(
      `
        UPDATE app.opportunities
        SET
          status = 'PROPOSAL_DRAFT',
          updated_at = now()
        WHERE id = $1
      `,
      [
        input.opportunityId,
      ],
    );

    await client.query(
      "COMMIT",
    );

    return mapProposal(
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


export async function createProposalRevision(
  input:
    CreateProposalRevisionInput,
): Promise<ProposalRevision> {
  if (
    typeof input.content !==
      "object" ||
    input.content === null ||
    Array.isArray(
      input.content,
    )
  ) {
    throw new Error(
      "Proposal revision content must be an object",
    );
  }

  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const proposal =
      await client.query(
        `
          SELECT id
          FROM app.proposals
          WHERE id = $1
            AND tenant_id = $2
            AND customer_id = $3
            AND opportunity_id = $4
          FOR UPDATE
        `,
        [
          input.proposalId,
          input.tenantId,
          input.customerId,
          input.opportunityId,
        ],
      );

    if (
      proposal.rowCount !== 1
    ) {
      throw new Error(
        "Proposal ownership validation failed",
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
          FROM app.proposal_revisions
          WHERE proposal_id = $1
        `,
        [
          input.proposalId,
        ],
      );

    const version =
      Number(
        versionResult.rows[0]
          .next_version,
      );

    await client.query(
      `
        UPDATE app.proposal_revisions
        SET status = 'SUPERSEDED'
        WHERE proposal_id = $1
          AND status IN (
            'DRAFT',
            'INTERNAL_REVIEW',
            'APPROVED'
          )
      `,
      [
        input.proposalId,
      ],
    );

    const result =
      await client.query<
        RevisionRow
      >(
        `
          INSERT INTO app.proposal_revisions (
            tenant_id,
            customer_id,
            opportunity_id,
            proposal_id,
            version,
            status,
            content,
            source_artifact_ids,
            docx_file_ref,
            pdf_file_ref
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'DRAFT',
            $6::jsonb,
            $7::jsonb,
            $8,
            $9
          )
          RETURNING
            id::text,
            tenant_id::text,
            customer_id::text,
            opportunity_id::text,
            proposal_id::text,
            version,
            status,
            content,
            source_artifact_ids,
            docx_file_ref,
            pdf_file_ref,
            created_at::text
        `,
        [
          input.tenantId,
          input.customerId,
          input.opportunityId,
          input.proposalId,
          version,

          JSON.stringify(
            input.content,
          ),

          JSON.stringify(
            input.sourceArtifactIds ??
            [],
          ),

          input.docxFileRef?.trim() ||
            null,

          input.pdfFileRef?.trim() ||
            null,
        ],
      );

    await client.query(
      `
        UPDATE app.proposals
        SET
          status = 'DRAFT',
          updated_at = now()
        WHERE id = $1
      `,
      [
        input.proposalId,
      ],
    );

    await client.query(
      "COMMIT",
    );

    return mapRevision(
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


export async function submitProposalRevisionForReview(
  tenantId: string,
  proposalRevisionId: string,
): Promise<void> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedRevisionId =
    requireText(
      proposalRevisionId,
      "proposalRevisionId",
    );

  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const revision =
      await client.query<{
        proposal_id: string;
        opportunity_id: string;
      }>(
        `
          UPDATE app.proposal_revisions
          SET status =
            'INTERNAL_REVIEW'
          WHERE id = $1
            AND tenant_id = $2
            AND status = 'DRAFT'
          RETURNING
            proposal_id::text,
            opportunity_id::text
        `,
        [
          normalizedRevisionId,
          normalizedTenantId,
        ],
      );

    const row =
      revision.rows[0];

    if (!row) {
      throw new Error(
        "Proposal revision must exist and be DRAFT before internal review",
      );
    }

    const proposal =
      await client.query(
        `
          UPDATE app.proposals
          SET
            status =
              'INTERNAL_REVIEW',
            updated_at =
              now()
          WHERE id = $1
            AND tenant_id = $2
            AND status IN (
              'DRAFT',
              'CHANGES_REQUESTED'
            )
        `,
        [
          row.proposal_id,
          normalizedTenantId,
        ],
      );

    if (
      proposal.rowCount !== 1
    ) {
      throw new Error(
        "Proposal could not enter INTERNAL_REVIEW",
      );
    }

    const opportunity =
      await client.query(
        `
          UPDATE app.opportunities
          SET
            status =
              'INTERNAL_REVIEW',
            updated_at =
              now()
          WHERE id = $1
            AND tenant_id = $2
            AND status IN (
              'PROPOSAL_DRAFT',
              'CONCEPT_DESIGN',
              'ANALYSIS'
            )
        `,
        [
          row.opportunity_id,
          normalizedTenantId,
        ],
      );

    if (
      opportunity.rowCount !==
        1
    ) {
      throw new Error(
        "Opportunity could not enter INTERNAL_REVIEW",
      );
    }

    await client.query(
      "COMMIT",
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


export async function createProposalReview(
  input:
    CreateProposalReviewInput,
): Promise<ProposalReview> {
  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const revision =
      await client.query<{
        status:
          ProposalRevisionStatus;
      }>(
        `
          SELECT status
          FROM app.proposal_revisions
          WHERE id = $1
            AND proposal_id = $2
            AND tenant_id = $3
            AND customer_id = $4
            AND opportunity_id = $5
          FOR UPDATE
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
      revision.rows[0].status !==
        "INTERNAL_REVIEW"
    ) {
      throw new Error(
        "Proposal revision is not in INTERNAL_REVIEW",
      );
    }

    const result =
      await client.query<
        ReviewRow
      >(
        `
          INSERT INTO app.proposal_reviews (
            tenant_id,
            customer_id,
            opportunity_id,
            proposal_id,
            proposal_revision_id,
            decision,
            reviewer_ref,
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
            reviewer_ref,
            comments,
            created_at::text
        `,
        [
          input.tenantId,
          input.customerId,
          input.opportunityId,
          input.proposalId,
          input.proposalRevisionId,
          input.decision,

          requireText(
            input.reviewerRef,
            "reviewerRef",
          ),

          input.comments?.trim() ||
            null,
        ],
      );

    if (
      input.decision ===
        "APPROVED"
    ) {
      await client.query(
        `
          UPDATE app.proposal_revisions
          SET status = 'APPROVED'
          WHERE id = $1
        `,
        [
          input.proposalRevisionId,
        ],
      );

      await client.query(
        `
          UPDATE app.proposals
          SET
            status = 'APPROVED',
            updated_at = now()
          WHERE id = $1
        `,
        [
          input.proposalId,
        ],
      );

      await client.query(
        `
          UPDATE app.opportunities
          SET
            status = 'READY_TO_SEND',
            updated_at = now()
          WHERE id = $1
        `,
        [
          input.opportunityId,
        ],
      );
    }
    else {
      if (
        input.decision ===
          "REJECTED"
      ) {
        await client.query(
          `
            UPDATE app.proposal_revisions
            SET status = 'REJECTED'
            WHERE id = $1
          `,
          [
            input.proposalRevisionId,
          ],
        );
      }

      await client.query(
        `
          UPDATE app.proposals
          SET
            status = 'CHANGES_REQUESTED',
            updated_at = now()
          WHERE id = $1
        `,
        [
          input.proposalId,
        ],
      );

      await client.query(
        `
          UPDATE app.opportunities
          SET
            status = 'PROPOSAL_DRAFT',
            updated_at = now()
          WHERE id = $1
        `,
        [
          input.opportunityId,
        ],
      );
    }

    await client.query(
      "COMMIT",
    );

    return mapReview(
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


export async function markProposalSent(
  tenantId: string,
  proposalId: string,
): Promise<void> {
  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const result =
      await client.query<{
        opportunity_id: string;
      }>(
        `
          UPDATE app.proposals
          SET
            status = 'SENT',
            updated_at = now()
          WHERE id = $1
            AND tenant_id = $2
            AND status = 'APPROVED'
          RETURNING opportunity_id::text
        `,
        [
          proposalId,
          tenantId,
        ],
      );

    if (
      result.rowCount !== 1
    ) {
      throw new Error(
        "Proposal must be APPROVED before sending",
      );
    }

    await client.query(
      `
        UPDATE app.opportunities
        SET
          status = 'SENT',
          updated_at = now()
        WHERE id = $1
      `,
      [
        result.rows[0]
          .opportunity_id,
      ],
    );

    await client.query(
      "COMMIT",
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


export async function markProposalAwaitingCustomer(
  tenantId: string,
  proposalId: string,
): Promise<void> {
  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const result =
      await client.query<{
        opportunity_id: string;
      }>(
        `
          UPDATE app.proposals
          SET
            status = 'AWAITING_CUSTOMER',
            updated_at = now()
          WHERE id = $1
            AND tenant_id = $2
            AND status = 'SENT'
          RETURNING opportunity_id::text
        `,
        [
          proposalId,
          tenantId,
        ],
      );

    if (
      result.rowCount !== 1
    ) {
      throw new Error(
        "Proposal must be SENT before awaiting customer decision",
      );
    }

    await client.query(
      `
        UPDATE app.opportunities
        SET
          status = 'AWAITING_CUSTOMER',
          updated_at = now()
        WHERE id = $1
      `,
      [
        result.rows[0]
          .opportunity_id,
      ],
    );

    await client.query(
      "COMMIT",
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


export async function getLatestProposalRevision(
  tenantId: string,
  proposalId: string,
): Promise<ProposalRevision | null> {
  const result =
    await appDb.query<
      RevisionRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          proposal_id::text,
          version,
          status,
          content,
          source_artifact_ids,
          docx_file_ref,
          pdf_file_ref,
          created_at::text
        FROM app.proposal_revisions
        WHERE tenant_id = $1
          AND proposal_id = $2
        ORDER BY version DESC
        LIMIT 1
      `,
      [
        tenantId,
        proposalId,
      ],
    );

  const row =
    result.rows[0];

  return row
    ? mapRevision(row)
    : null;
}
