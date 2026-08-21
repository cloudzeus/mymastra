import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createInitialOpportunity,
  createPresalesRepositoryWorkspace,
  createPresalesSource,
  provisionPresalesRepository,
  runPresalesBusinessTechnicalAnalysis,
} from "../src/mastra/presales";


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      `ASSERTION FAILED: ${message}`,
    );
  }
}


async function main(): Promise<void> {
  let opportunityId:
    string | undefined;

  let sourceId:
    string | undefined;

  let workspacePath:
    string | undefined;

  let passed =
    false;


  try {
    console.log(
      "\n--- LOAD FIXTURE OWNER ---",
    );


    const owner =
      await appDb.query<{
        tenant_id: string;
        customer_id: string;
      }>(
        `
          SELECT
            c.tenant_id::text,
            c.id::text AS customer_id
          FROM app.customers c
          JOIN app.tenants t
            ON t.id = c.tenant_id
          WHERE t.is_active = true
          ORDER BY c.created_at ASC
          LIMIT 1
        `,
      );


    const ownerRow =
      owner.rows[0];


    if (!ownerRow) {
      throw new Error(
        "No customer fixture available",
      );
    }


    const tenantId =
      ownerRow.tenant_id;


    const customerId =
      ownerRow.customer_id;


    console.log(
      "\n--- CREATE OPPORTUNITY ---",
    );


    const initial =
      await createInitialOpportunity({
        tenantId,

        customerId,

        opportunity: {
          code:
            `DGPARKING-AADE-${Date.now()}`,

          title:
            "DG Parking – Ψηφιακό Πελατολόγιο ΑΑΔΕ",

          description:
            "Analysis of the existing Milesight LPR parking management application for integration with the AADE Digital Client Registry.",

          source:
            "REAL_CUSTOMER_USE_CASE",
        },

        request: {
          title:
            "Διασύνδεση DG Parking με Ψηφιακό Πελατολόγιο ΑΑΔΕ",

          requestText:
            [
              "Ο πελάτης διαθέτει υφιστάμενη εφαρμογή διαχείρισης parking.",
              "Η εφαρμογή χρησιμοποιεί Milesight LPR cameras για αυτόματη αναγνώριση πινακίδων οχημάτων κατά τη λειτουργία του parking.",
              "Ο πελάτης ζητά να διασυνδεθεί η υπάρχουσα εφαρμογή με το Ψηφιακό Πελατολόγιο της ΑΑΔΕ.",
              "Ανάλυσε το υπάρχον repository και εντόπισε την πραγματική αρχιτεκτονική, τα data models, τα LPR event flows και τα πιθανά integration points.",
              "Εντόπισε πώς σήμερα αναπαρίστανται η είσοδος, η έξοδος, η πινακίδα, το όχημα, οι πελάτες, οι συναλλαγές ή οι parking sessions, εφόσον υπάρχουν.",
              "Διαχώρισε αυστηρά VERIFIED στοιχεία που αποδεικνύονται από αρχεία του repository από INFERRED συμπεράσματα.",
              "Κάθε VERIFIED finding πρέπει να έχει πραγματικό repository-relative fileRef.",
              "Μην τροποποιήσεις κανένα αρχείο και μην προτείνεις ακόμα implementation code.",
              "Για απαιτήσεις, endpoints, fields ή business rules της ΑΑΔΕ που δεν αποδεικνύονται από authoritative source διαθέσιμο στο current analysis, δήλωσέ τα ως unresolved ή dependency και μην τα επινοήσεις.",
              "Στόχος είναι evidence-backed InitialSolutionApproach για την επέκταση της υπάρχουσας εφαρμογής.",
            ].join(
              " ",
            ),

          sourceChannel:
            "CUSTOMER_REQUIREMENT",
        },
      });


    opportunityId =
      initial.opportunity.id;


    console.log(
      "opportunityId:",
      opportunityId,
    );


    console.log(
      "\n--- CREATE REPOSITORY SOURCE ---",
    );


    const source =
      await createPresalesSource({
        tenantId,

        customerId,

        opportunityId,

        sourceType:
          "REPOSITORY",

        title:
          "DG Parking production application repository",

        repositoryProvider:
          "GITHUB",

        repositoryUrl:
          "https://github.com/cloudzeus/dgparking.git",

        requestedRef:
          "master",
      });


    sourceId =
      source.id;


    const workspace =
      await createPresalesRepositoryWorkspace(
        tenantId,
        source.id,
      );


    workspacePath =
      workspace.workspacePath;


    console.log(
      "\n--- PROVISION REPOSITORY ---",
    );


    const readyWorkspace =
      await provisionPresalesRepository(
        tenantId,
        source.id,
      );


    assert(
      readyWorkspace.status ===
        "READY",
      "workspace READY",
    );


    assert(
      !!readyWorkspace.resolvedCommit,
      "workspace exact commit",
    );


    console.log(
      "resolvedRef:",
      readyWorkspace.resolvedRef,
    );


    console.log(
      "resolvedCommit:",
      readyWorkspace.resolvedCommit,
    );


    console.log(
      "\n--- RUN REAL ANALYST ---",
    );


    const result =
      await runPresalesBusinessTechnicalAnalysis({
        tenantId,

        customerId,

        opportunityId,

        presalesSourceIds: [
          source.id,
        ],

        timeoutMs:
          180_000,
      });


    assert(
      result.repositoryInspections.length ===
        1,
      "exactly one repository inspection",
    );


    const inspection =
      result.repositoryInspections[0];


    assert(
      inspection.presalesSourceId ===
        source.id,
      "inspection source binding",
    );


    assert(
      inspection.resolvedCommit ===
        readyWorkspace.resolvedCommit,
      "inspection exact authoritative commit",
    );


    const verified =
      inspection.findings.filter(
        finding =>
          finding.confidence ===
            "VERIFIED",
      );


    const inferred =
      inspection.findings.filter(
        finding =>
          finding.confidence ===
            "INFERRED",
      );


    assert(
      verified.some(
        finding =>
          finding.fileRefs.length >
            0,
      ),
      "at least one VERIFIED finding with file evidence",
    );


    const approach =
      result.initialSolutionApproach;


    assert(
      approach.opportunityId ===
        opportunityId,
      "approach opportunity binding",
    );


    assert(
      approach.customerId ===
        customerId,
      "approach customer binding",
    );


    assert(
      approach.metadata.repositoryMode ===
        "EXISTING",
      "approach repository mode",
    );


    assert(
      approach.metadata.presalesSourceIds?.includes(
        source.id,
      ),
      "approach source evidence binding",
    );


    assert(
      approach.metadata.repositoryInspectionIds?.includes(
        inspection.id,
      ),
      "approach inspection evidence binding",
    );


    assert(
      approach.metadata.existingSystemAnalysis
        ?.inspected ===
        true,
      "existing system inspected",
    );


    assert(
      approach.metadata.existingSystemAnalysis
        ?.inspectedCommit ===
        readyWorkspace.resolvedCommit,
      "approach authoritative inspected commit",
    );


    console.log(
      "\n--- RESULT ---",
    );


    console.log(
      "inspectionId:",
      inspection.id,
    );


    console.log(
      "approachId:",
      approach.id,
    );


    console.log(
      "approachVersion:",
      approach.version,
    );


    console.log(
      "detectedStack:",
      inspection.detectedStack,
    );


    console.log(
      "relevantFiles:",
      inspection.relevantFiles,
    );


    console.log(
      "verifiedFindings:",
      verified.length,
    );


    for (
      const finding
      of verified
    ) {
      console.log(
        "VERIFIED:",
        finding.statement,
      );

      console.log(
        "  refs:",
        finding.fileRefs,
      );
    }


    console.log(
      "inferredFindings:",
      inferred.length,
    );


    for (
      const finding
      of inferred
    ) {
      console.log(
        "INFERRED:",
        finding.statement,
      );
    }


    console.log(
      "\napproachText:",
      approach.approachText,
    );


    console.log(
      "\nexistingSystemAnalysis:",
      JSON.stringify(
        approach.metadata
          .existingSystemAnalysis,
        null,
        2,
      ),
    );


    passed =
      true;


    console.log(
      "\nREAL DGPARKING PRESALES ANALYSIS: PASS",
    );
  }
  finally {
    console.log(
      "\n--- FILESYSTEM CLEANUP ---",
    );


    if (
      workspacePath &&
      workspacePath.startsWith(
        "/opt/mastra-presales-repositories/",
      )
    ) {
      const {
        rm,
      } =
        await import(
          "node:fs/promises"
        );


      await rm(
        workspacePath,
        {
          recursive:
            true,

          force:
            true,
        },
      );
    }


    if (
      passed &&
      opportunityId
    ) {
      await appDb.query(
        `
          DELETE FROM app.repository_inspections
          WHERE opportunity_id = $1::uuid
        `,
        [
          opportunityId,
        ],
      );


      await appDb.query(
        `
          DELETE FROM app.presales_repository_workspaces
          WHERE opportunity_id = $1::uuid
        `,
        [
          opportunityId,
        ],
      );


      await appDb.query(
        `
          DELETE FROM app.presales_sources
          WHERE opportunity_id = $1::uuid
        `,
        [
          opportunityId,
        ],
      );


      await appDb.query(
        `
          DELETE FROM app.initial_solution_approaches
          WHERE opportunity_id = $1::uuid
        `,
        [
          opportunityId,
        ],
      );


      await appDb.query(
        `
          DELETE FROM app.customer_requests
          WHERE opportunity_id = $1::uuid
        `,
        [
          opportunityId,
        ],
      );


      await appDb.query(
        `
          DELETE FROM app.ai_cost_ledger
          WHERE ai_run_id IN (
            SELECT id
            FROM app.ai_runs
            WHERE opportunity_id = $1::uuid
          )
        `,
        [
          opportunityId,
        ],
      );


      await appDb.query(
        `
          DELETE FROM app.ai_token_usage
          WHERE ai_run_id IN (
            SELECT id
            FROM app.ai_runs
            WHERE opportunity_id = $1::uuid
          )
        `,
        [
          opportunityId,
        ],
      );


      await appDb.query(
        `
          DELETE FROM app.ai_runs
          WHERE opportunity_id = $1::uuid
        `,
        [
          opportunityId,
        ],
      );


      await appDb.query(
        `
          DELETE FROM app.opportunities
          WHERE id = $1::uuid
        `,
        [
          opportunityId,
        ],
      );


      console.log(
        "Business fixture cleanup completed.",
      );
    }
    else {
      console.log(
        "Database fixture preserved for diagnosis.",
      );
    }


    await appDb.end();
  }
}


main().catch(
  error => {
    console.error(
      "\nREAL DGPARKING PRESALES ANALYSIS: FAIL\n",
      error,
    );


    process.exitCode =
      1;
  },
);
