import {
  appDb,
} from "../db/postgres";

import type {
  ConvertOpportunityToProjectInput,
  ConvertOpportunityToProjectResult,
} from "./types";


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


export async function convertAcceptedOpportunityToProject(
  input:
    ConvertOpportunityToProjectInput,
): Promise<ConvertOpportunityToProjectResult> {
  const tenantId =
    requireText(
      input.tenantId,
      "tenantId",
    );

  const opportunityId =
    requireText(
      input.opportunityId,
      "opportunityId",
    );

  const projectCode =
    requireText(
      input.projectCode,
      "projectCode",
    );

  const projectName =
    requireText(
      input.projectName,
      "projectName",
    );

  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const opportunity =
      await client.query<{
        id: string;
        customer_id: string;
        status: string;
        converted_project_id:
          string | null;
      }>(
        `
          SELECT
            id::text,
            customer_id::text,
            status,
            converted_project_id::text
          FROM app.opportunities
          WHERE id = $1
            AND tenant_id = $2
          FOR UPDATE
        `,
        [
          opportunityId,
          tenantId,
        ],
      );

    const opportunityRow =
      opportunity.rows[0];

    if (!opportunityRow) {
      throw new Error(
        "Opportunity not found",
      );
    }

    if (
      opportunityRow
        .converted_project_id
    ) {
      throw new Error(
        `Opportunity is already converted to project ${opportunityRow.converted_project_id}`,
      );
    }

    if (
      opportunityRow.status !==
        "ACCEPTED"
    ) {
      throw new Error(
        `Opportunity must be ACCEPTED before conversion. Current status: ${opportunityRow.status}`,
      );
    }

    const acceptedDecision =
      await client.query<{
        id: string;
        proposal_id: string;
        proposal_revision_id:
          string;
        revision_status: string;
      }>(
        `
          SELECT
            d.id::text,
            d.proposal_id::text,
            d.proposal_revision_id::text,
            r.status AS revision_status
          FROM app.customer_decisions d
          JOIN app.proposal_revisions r
            ON r.id =
              d.proposal_revision_id
          WHERE d.opportunity_id = $1
            AND d.tenant_id = $2
            AND d.customer_id = $3
            AND d.decision = 'ACCEPTED'
          ORDER BY
            d.effective_at DESC,
            d.created_at DESC
          LIMIT 1
        `,
        [
          opportunityId,
          tenantId,
          opportunityRow
            .customer_id,
        ],
      );

    const decision =
      acceptedDecision.rows[0];

    if (!decision) {
      throw new Error(
        "No ACCEPTED customer decision exists for this opportunity",
      );
    }

    if (
      decision.revision_status !==
        "APPROVED"
    ) {
      throw new Error(
        "Accepted proposal revision is no longer internally APPROVED",
      );
    }

    const project =
      await client.query<{
        id: string;
      }>(
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
            'DRAFT'
          )
          RETURNING id::text
        `,
        [
          tenantId,
          projectCode,
          projectName,

          input.projectDescription
            ?.trim() ||
            null,
        ],
      );

    const projectId =
      project.rows[0].id;

    const update =
      await client.query(
        `
          UPDATE app.opportunities
          SET
            converted_project_id = $3,
            status =
              'CONVERTED_TO_PROJECT',
            updated_at = now()
          WHERE id = $1
            AND tenant_id = $2
            AND converted_project_id
              IS NULL
        `,
        [
          opportunityId,
          tenantId,
          projectId,
        ],
      );

    if (
      update.rowCount !== 1
    ) {
      throw new Error(
        "Opportunity conversion failed due to concurrent modification",
      );
    }

    await client.query(
      "COMMIT",
    );

    return {
      projectId,
      opportunityId,

      acceptedCustomerDecisionId:
        decision.id,

      projectDefinitionRequired:
        true,
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
