import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  getSoftOneImplementationSource,
  enqueueSoftOneImplementationKnowledge,
} from "../src/mastra/softone/implementation-knowledge-promotion";

import {
  loadSoftOneReviewQueue,
} from "../src/mastra/softone/review-queue";


type CapabilityMember = {
  candidateId: string;
  repositoryName: string;
  implementationName: string;
  preferred: boolean;
  reuseMode: string;
  confidence: number;
};


async function listCapabilityMembers(
  canonicalKey: string,
): Promise<CapabilityMember[]> {
  const result =
    await appDb.query(
      `
        SELECT
          c.id::text AS candidate_id,
          r.repository_name,
          c.name AS implementation_name,

          (
            c.id =
            cap.preferred_candidate_id
          ) AS preferred,

          c.reuse_mode,
          c.confidence

        FROM app.implementation_capabilities cap

        JOIN app.implementation_capability_members m
          ON m.capability_id = cap.id

        JOIN app.implementation_candidates c
          ON c.id = m.candidate_id

        JOIN app.implementation_repositories r
          ON r.id = c.repository_id

        WHERE cap.canonical_key = $1
          AND cap.status = 'ACTIVE'
          AND c.admin_status <> 'IGNORED'
          AND c.reuse_mode <> 'NOT_SUITABLE'

        ORDER BY
          (
            c.id =
            cap.preferred_candidate_id
          ) DESC,
          m.similarity_score DESC,
          c.confidence DESC,
          r.repository_name
      `,
      [
        canonicalKey,
      ],
    );


  return result.rows.map(
    row => ({
      candidateId:
        String(
          row.candidate_id,
        ),

      repositoryName:
        String(
          row.repository_name,
        ),

      implementationName:
        String(
          row.implementation_name,
        ),

      preferred:
        Boolean(
          row.preferred,
        ),

      reuseMode:
        String(
          row.reuse_mode,
        ),

      confidence:
        Number(
          row.confidence,
        ),
    }),
  );
}


function hasExistingReviewHistory(
  input: {
    repositoryOwner: string;
    repositoryName: string;
    commit: string;
    candidateId: string;
  },
): boolean {
  const expectedSourceKey =
    [
      "IMPLEMENTATION_REPOSITORY",
      input.repositoryOwner,
      input.repositoryName,
      input.commit,
      input.candidateId,
    ].join(
      ":",
    );


  const queue =
    loadSoftOneReviewQueue();


  return queue.items.some(
    item =>
      item.sourceKey ===
      expectedSourceKey,
  );
}


async function main() {
  const canonicalKey =
    process.argv[2];


  if (!canonicalKey) {
    throw new Error(
      [
        "Usage:",
        "npx tsx scripts/extract-softone-capability-corpus.ts",
        "<SOFTONE_CAPABILITY>",
      ].join(
        " ",
      ),
    );
  }


  if (
    !canonicalKey.startsWith(
      "SOFTONE_",
    )
  ) {
    throw new Error(
      "Only SOFTONE_* capabilities are allowed",
    );
  }


  const members =
    await listCapabilityMembers(
      canonicalKey,
    );


  if (
    members.length === 0
  ) {
    throw new Error(
      `No eligible members found for ${canonicalKey}`,
    );
  }


  console.log(
    "\n--- SOFTONE CAPABILITY CORPUS ---",
  );

  console.log(
    "capability:",
    canonicalKey,
  );

  console.log(
    "eligible implementations:",
    members.length,
  );


  let processed =
    0;

  let skipped =
    0;

  let extractedClaims =
    0;

  let queuedClaims =
    0;


  const failures:
    Array<{
      candidateId: string;
      repository: string;
      error: string;
    }> = [];


  for (
    const member
    of members
  ) {
    console.log(
      [
        "\n>>>",
        member.repositoryName,
        "|",
        member.implementationName,
        member.preferred
          ? "| PREFERRED"
          : "",
      ].join(
        " ",
      ),
    );


    try {
      const source =
        await getSoftOneImplementationSource(
          canonicalKey,
          member.candidateId,
        );


      if (
        hasExistingReviewHistory({
          repositoryOwner:
            source.repositoryOwner,

          repositoryName:
            source.repositoryName,

          commit:
            source.commit,

          candidateId:
            source.candidateId,
        })
      ) {
        console.log(
          "SKIP: implementation already has review/evidence history at this pinned commit",
        );

        skipped += 1;

        continue;
      }


      const result =
        await enqueueSoftOneImplementationKnowledge({
          canonicalKey,

          candidateId:
            member.candidateId,
        });


      processed += 1;

      extractedClaims +=
        result.extractedClaims;

      queuedClaims +=
        result.queuedClaims;


      console.log(
        "PASS:",
        {
          candidateId:
            source.candidateId,

          repository:
            `${source.repositoryOwner}/${source.repositoryName}`,

          commit:
            source.commit,

          extractedClaims:
            result.extractedClaims,

          queuedClaims:
            result.queuedClaims,

          skippedFiles:
            result.skippedFiles.length,
        },
      );
    }
    catch (
      error
    ) {
      failures.push({
        candidateId:
          member.candidateId,

        repository:
          member.repositoryName,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      });


      console.error(
        "FAIL:",
        member.repositoryName,
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }


  console.log(
    "\n--- CORPUS RESULT ---",
  );

  console.log(
    "members:",
    members.length,
  );

  console.log(
    "processed:",
    processed,
  );

  console.log(
    "skipped existing:",
    skipped,
  );

  console.log(
    "extracted claims:",
    extractedClaims,
  );

  console.log(
    "queued claims:",
    queuedClaims,
  );

  console.log(
    "failures:",
    failures.length,
  );


  if (
    failures.length
  ) {
    console.table(
      failures,
    );

    process.exitCode =
      1;

    return;
  }


  console.log(
    "\nSOFTONE CAPABILITY CORPUS: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nSOFTONE CAPABILITY CORPUS: FAIL",
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await appDb.end();
    },
  );
