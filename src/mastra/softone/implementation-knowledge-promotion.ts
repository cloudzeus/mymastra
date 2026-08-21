import {
  createHash,
} from "node:crypto";

import {
  appDb,
} from "../db/postgres";

import {
  enqueueSoftOneCandidateForReview,
} from "./review-queue";

import {
  extractSoftOneImplementationKnowledge,
} from "./implementation-knowledge-extractor";

import type {
  SoftOneEvidenceRecord,
} from "./evidence-types";

import type {
  SoftOneIngestionCandidate,
} from "./ingestion-types";

import type {
  SoftOneImplementationSource,
} from "./implementation-knowledge-types";


function hash(
  value: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
    )
    .digest(
      "hex",
    );
}


function evidenceId(
  input: {
    candidateId: string;
    commit: string;
    claim: string;
  },
): string {
  return [
    "IMPL",
    hash(
      [
        input.candidateId,
        input.commit,
        input.claim
          .trim()
          .toLowerCase(),
      ].join(
        "|",
      ),
    )
      .slice(
        0,
        24,
      )
      .toUpperCase(),
  ].join(
    "_",
  );
}


function sourceFingerprint(
  input: {
    repositoryUrl: string;
    commit: string;
    files: string[];
  },
): string {
  return hash(
    [
      input.repositoryUrl,
      input.commit,
      ...[
        ...input.files,
      ].sort(),
    ].join(
      "|",
    ),
  );
}


function parseJsonStringArray(
  value: unknown,
): string[] {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.filter(
      (
        item,
      ): item is string =>
        typeof item ===
        "string",
    );
  }


  if (
    typeof value ===
      "string"
  ) {
    try {
      const parsed =
        JSON.parse(
          value,
        );


      return Array.isArray(
        parsed,
      )
        ? parsed.filter(
            (
              item,
            ): item is string =>
              typeof item ===
              "string",
          )
        : [];
    }
    catch {
      return [];
    }
  }


  return [];
}


export async function getSoftOneImplementationSource(
  canonicalKey: string,
  candidateId?: string,
): Promise<SoftOneImplementationSource> {
  const result =
    await appDb.query(
      `
        SELECT
          c.id::text AS candidate_id,
          cap.canonical_key,

          r.id::text AS repository_id,
          r.owner,
          r.repository_name,
          r.repository_url,
          r.scanned_commit,

          c.source_commit,
          c.name,
          c.source_files

        FROM app.implementation_capabilities cap

        JOIN app.implementation_capability_members m
          ON m.capability_id = cap.id

        JOIN app.implementation_candidates c
          ON c.id = m.candidate_id

        JOIN app.implementation_repositories r
          ON r.id = c.repository_id

        WHERE cap.canonical_key = $1

          AND c.admin_status <> 'IGNORED'

          AND (
            $2::uuid IS NULL
            AND c.id = cap.preferred_candidate_id

            OR

            $2::uuid IS NOT NULL
            AND c.id = $2::uuid
          )

        LIMIT 1
      `,
      [
        canonicalKey,
        candidateId ??
          null,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      candidateId
        ? `SoftOne implementation candidate not found in capability ${canonicalKey}: ${candidateId}`
        : `Preferred implementation not found for capability ${canonicalKey}`,
    );
  }


  const commit =
    String(
      row.source_commit ??
      row.scanned_commit ??
      "",
    );


  if (!commit) {
    throw new Error(
      `No pinned source commit for candidate ${row.candidate_id}`,
    );
  }


  return {
    candidateId:
      String(
        row.candidate_id,
      ),

    capabilityKey:
      String(
        row.canonical_key,
      ),

    repositoryId:
      String(
        row.repository_id,
      ),

    repositoryOwner:
      String(
        row.owner,
      ),

    repositoryName:
      String(
        row.repository_name,
      ),

    repositoryUrl:
      String(
        row.repository_url,
      ),

    commit,

    implementationName:
      String(
        row.name,
      ),

    sourceFiles:
      parseJsonStringArray(
        row.source_files,
      ),
  };
}


export async function enqueueSoftOneImplementationKnowledge(
  input: {
    canonicalKey: string;
    candidateId?: string;
  },
) {
  const source =
    await getSoftOneImplementationSource(
      input.canonicalKey,
      input.candidateId,
    );


  const extraction =
    await extractSoftOneImplementationKnowledge(
      source,
    );


  const queued =
    [];


  for (
    const claim
    of extraction.claims
  ) {
    const id =
      evidenceId({
        candidateId:
          source.candidateId,

        commit:
          source.commit,

        claim:
          claim.claim,
      });


    const evidence:
      SoftOneEvidenceRecord = {
      id,

      claim:
        claim.claim,

      kind:
        claim.kind,

      /*
       * Implementation evidence starts DERIVED.
       * It must never enter as VERIFIED.
       */
      status:
        "DERIVED",

      scope:
        "RECIPE",

      productAreas:
        claim.productAreas,

      sources:
        claim.evidenceFiles.map(
          filePath => ({
            sourceId:
              "IMPLEMENTATION_REPOSITORY",

            sourceUrl:
              source.repositoryUrl,

            sourceTitle:
              `${source.repositoryOwner}/${source.repositoryName}`,

            section:
              filePath,

            retrievedAt:
              new Date()
                .toISOString(),

            notes: [
              `Repository: ${source.repositoryOwner}/${source.repositoryName}`,
              `Commit: ${source.commit}`,
              `Source file: ${filePath}`,
              `Implementation candidate: ${source.candidateId}`,
              `Capability: ${source.capabilityKey}`,
              "Read from the exact pinned Git commit.",
              "Working implementation evidence only; not authoritative SoftOne documentation.",
            ],
          }),
        ),

      conditions:
        claim.conditions,

      limitations: [
        ...(
          claim.limitations ??
          []
        ),

        "Evidence originates from an implementation repository and may contain project-specific or tenant-specific assumptions.",

        "Human review is required before ingestion.",
      ],

      verificationNotes: [
        `Implementation extraction confidence: ${claim.confidence}`,
        `Candidate: ${source.candidateId}`,
        `Capability: ${source.capabilityKey}`,
        `Repository commit: ${source.commit}`,
      ],

      tags: [
        "implementation-evidence",
        "github",
        source.capabilityKey
          .toLowerCase(),
        ...(
          claim.tags ??
          []
        ),
      ],

      createdAt:
        new Date()
          .toISOString(),
    };


    const candidate:
      SoftOneIngestionCandidate = {
      id:
        `CANDIDATE_${id}`,

      source:
        "GITHUB",

      sourceKey:
        [
          "IMPLEMENTATION_REPOSITORY",
          source.repositoryOwner,
          source.repositoryName,
          source.commit,
          source.candidateId,
        ].join(
          ":",
        ),

      sourceFingerprint:
        sourceFingerprint({
          repositoryUrl:
            source.repositoryUrl,

          commit:
            source.commit,

          files:
            claim.evidenceFiles,
        }),

      status:
        "NEEDS_REVIEW",

      evidence,

      rawReference: {
        subject:
          `${source.capabilityKey}: ${source.implementationName}`,
      },

      extraction: {
        automatic:
          true,

        confidence:
          claim.confidence,

        reason: [
          "Claim extracted automatically from source code in a pinned implementation repository.",
          "Implementation evidence can demonstrate a working pattern but does not independently establish canonical SoftOne behavior.",
          `Repository: ${source.repositoryOwner}/${source.repositoryName}`,
          `Commit: ${source.commit}`,
          `Files: ${claim.evidenceFiles.join(", ")}`,
        ],

        requiresHumanReview:
          true,
      },

      createdAt:
        new Date()
          .toISOString(),
    };


    const review =
      enqueueSoftOneCandidateForReview(
        candidate,
        {
          classification:
            source.capabilityKey,

          reason:
            "Implementation-derived SoftOne knowledge requires human review before evidence ingestion.",

          notes: [
            `Candidate: ${source.candidateId}`,
            `Repository: ${source.repositoryOwner}/${source.repositoryName}`,
            `Commit: ${source.commit}`,
            `Files: ${claim.evidenceFiles.join(", ")}`,
          ],
        },
      );


    queued.push({
      evidenceId:
        evidence.id,

      reviewId:
        review.id,

      claim:
        evidence.claim,

      kind:
        evidence.kind,

      confidence:
        claim.confidence,
    });
  }


  return {
    source,

    extractedClaims:
      extraction.claims.length,

    queuedClaims:
      queued.length,

    skippedFiles:
      extraction.skippedFiles,

    queued,
  };
}
