import {
  ingestSoftOneEvidenceCandidate,
} from "../src/mastra/softone/evidence-ingestion";

import {
  extractSoftOneOfficialWsEvidence,
} from "../src/mastra/softone/official-ws-evidence-extractor";


function main() {
  console.log(
    "--- SOFTONE OFFICIAL WS EVIDENCE INGESTION ---",
  );


  const candidates =
    extractSoftOneOfficialWsEvidence();


  console.log(
    "candidates:",
    candidates.length,
  );


  const results =
    candidates.map(
      candidate => {
        const result =
          ingestSoftOneEvidenceCandidate(
            candidate,
          );


        return {
          candidateId:
            candidate.id,

          evidenceId:
            candidate.evidence.id,

          section:
            candidate.rawReference?.section ??
            "",

          claim:
            candidate.evidence.claim,

          action:
            result.action,

          success:
            result.success,

          effectiveStatus:
            result.effectiveStatus,

          corroboration:
            result.corroboration,

          errors:
            result.errors.join(
              " | ",
            ),

          warnings:
            result.warnings.join(
              " | ",
            ),
        };
      },
    );


  console.table(
    results.map(
      result => ({
        section:
          result.section,

        evidenceId:
          result.evidenceId,

        action:
          result.action,

        status:
          result.effectiveStatus,

        corroboration:
          result.corroboration,

        success:
          result.success,
      }),
    ),
  );


  const failed =
    results.filter(
      result =>
        !result.success,
    );


  console.log(
    "\ninserted:",
    results.filter(
      result =>
        result.action ===
        "INSERTED",
    ).length,
  );

  console.log(
    "updated:",
    results.filter(
      result =>
        result.action ===
        "UPDATED",
    ).length,
  );

  console.log(
    "duplicate:",
    results.filter(
      result =>
        result.action ===
        "DUPLICATE",
    ).length,
  );

  console.log(
    "verified:",
    results.filter(
      result =>
        result.effectiveStatus ===
        "VERIFIED",
    ).length,
  );

  console.log(
    "derived:",
    results.filter(
      result =>
        result.effectiveStatus ===
        "DERIVED",
    ).length,
  );

  console.log(
    "failed:",
    failed.length,
  );


  if (
    failed.length
  ) {
    console.table(
      failed.map(
        result => ({
          evidenceId:
            result.evidenceId,

          section:
            result.section,

          action:
            result.action,

          errors:
            result.errors,

          warnings:
            result.warnings,
        }),
      ),
    );


    throw new Error(
      `${failed.length} official WS evidence candidate(s) failed ingestion.`,
    );
  }


  console.log(
    "\nSOFTONE OFFICIAL WS EVIDENCE INGESTION: PASS",
  );
}


try {
  main();
}
catch (
  error
) {
  console.error(
    "\nSOFTONE OFFICIAL WS EVIDENCE INGESTION: FAIL",
  );

  console.error(
    error,
  );

  process.exitCode =
    1;
}
