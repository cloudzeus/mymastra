import {
  appDb,
} from "../db/postgres";


export type CapabilityAdminStatus =
  | "CANDIDATE"
  | "APPROVED"
  | "IGNORED";


export type SecurityReviewStatus =
  | "UNREVIEWED"
  | "PASS"
  | "PASS_WITH_NOTES"
  | "REJECTED";


export type CandidateForClustering = {
  id: string;

  repositoryId: string;

  repositoryName: string;

  repositorySummary?: string;

  sourceCommit: string;

  name: string;

  category: string;

  problemSolved: string;

  description?: string;

  tags: string[];

  technologies: string[];

  reusableParts: string[];

  reuseMode: string;

  confidence: number;

  completenessScore: number;

  isolationScore: number;

  productionScore: number;

  portabilityScore: number;

  maintainabilityScore: number;

  securityStatus: string;
};


export type CapabilityClusterInput = {
  candidateId: string;

  canonicalKey: string;

  name: string;

  description: string;

  category: string;

  tags: string[];

  similarityScore: number;

  confidence: number;
};


function jsonStrings(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is string =>
      typeof item === "string",
  );
}


function clamp(
  value: unknown,
  min: number,
  max: number,
): number {
  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return min;
  }

  return Math.max(
    min,
    Math.min(
      max,
      Math.round(parsed),
    ),
  );
}


export async function listUnclusteredCandidates(
  limit = 25,
): Promise<CandidateForClustering[]> {
  const result =
    await appDb.query(
      `
        SELECT
          c.id::text,
          c.repository_id::text,
          r.repository_name,
          r.summary AS repository_summary,
          COALESCE(
            c.source_commit,
            r.scanned_commit
          ) AS source_commit,

          c.name,
          c.category,
          c.problem_solved,
          c.description,

          c.tags,
          c.technologies,
          c.reusable_parts,

          c.reuse_mode,
          c.confidence,

          c.completeness_score,
          c.isolation_score,
          c.production_score,
          c.portability_score,
          c.maintainability_score,

          c.security_status

        FROM app.implementation_candidates c

        JOIN app.implementation_repositories r
          ON r.id = c.repository_id

        WHERE c.admin_status <> 'IGNORED'

          AND NOT EXISTS (
            SELECT 1
            FROM app.implementation_capability_members m
            WHERE m.candidate_id = c.id
          )

        ORDER BY
          c.confidence DESC,
          c.overall_score DESC,
          r.repository_name,
          c.name

        LIMIT $1
      `,
      [
        limit,
      ],
    );


  return result.rows.map(
    row => ({
      id:
        String(row.id),

      repositoryId:
        String(row.repository_id),

      repositoryName:
        String(row.repository_name),

      repositorySummary:
        typeof row.repository_summary === "string"
          ? row.repository_summary
          : undefined,

      sourceCommit:
        String(row.source_commit ?? ""),

      name:
        String(row.name),

      category:
        String(row.category),

      problemSolved:
        String(row.problem_solved),

      description:
        typeof row.description === "string"
          ? row.description
          : undefined,

      tags:
        jsonStrings(row.tags),

      technologies:
        jsonStrings(row.technologies),

      reusableParts:
        jsonStrings(row.reusable_parts),

      reuseMode:
        String(row.reuse_mode),

      confidence:
        Number(row.confidence),

      completenessScore:
        Number(row.completeness_score),

      isolationScore:
        Number(row.isolation_score),

      productionScore:
        Number(row.production_score),

      portabilityScore:
        Number(row.portability_score),

      maintainabilityScore:
        Number(row.maintainability_score),

      securityStatus:
        String(row.security_status),
    }),
  );
}


export async function listCapabilityDictionary(): Promise<
  Array<{
    id: string;
    canonicalKey: string;
    name: string;
    category: string;
  }>
> {
  const result =
    await appDb.query(
      `
        SELECT
          id::text,
          canonical_key,
          name,
          category
        FROM app.implementation_capabilities
        WHERE canonical_key IS NOT NULL
          AND status = 'ACTIVE'
          AND admin_status <> 'IGNORED'
        ORDER BY canonical_key
      `,
    );


  return result.rows.map(
    row => ({
      id:
        String(row.id),

      canonicalKey:
        String(row.canonical_key),

      name:
        String(row.name),

      category:
        String(row.category),
    }),
  );
}


export async function assignCandidateToCapability(
  input: CapabilityClusterInput,
): Promise<string> {
  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );


    const capability =
      await client.query(
        `
          INSERT INTO app.implementation_capabilities (
            canonical_key,
            name,
            description,
            category,
            tags,
            confidence,
            admin_status,
            cluster_method,
            status
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5::jsonb,
            $6,
            'CANDIDATE',
            'SEMANTIC',
            'ACTIVE'
          )

          ON CONFLICT (canonical_key)
          WHERE canonical_key IS NOT NULL

          DO UPDATE SET
            description =
              CASE
                WHEN length(EXCLUDED.description) >
                     length(app.implementation_capabilities.description)
                THEN EXCLUDED.description
                ELSE app.implementation_capabilities.description
              END,

            confidence =
              GREATEST(
                app.implementation_capabilities.confidence,
                EXCLUDED.confidence
              ),

            updated_at =
              now()

          RETURNING id::text
        `,
        [
          input.canonicalKey,
          input.name,
          input.description,
          input.category,
          JSON.stringify(
            input.tags,
          ),
          clamp(
            input.confidence,
            0,
            100,
          ),
        ],
      );


    const capabilityId =
      String(
        capability.rows[0].id,
      );


    await client.query(
      `
        INSERT INTO app.implementation_capability_members (
          capability_id,
          candidate_id,
          similarity_score
        )
        VALUES (
          $1,
          $2,
          $3
        )

        ON CONFLICT (
          capability_id,
          candidate_id
        )

        DO UPDATE SET
          similarity_score =
            EXCLUDED.similarity_score
      `,
      [
        capabilityId,
        input.candidateId,
        clamp(
          input.similarityScore,
          0,
          100,
        ) / 100,
      ],
    );


    await client.query(
      "COMMIT",
    );


    return capabilityId;
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


function candidateRankScore(
  row: Record<string, unknown>,
): number {
  const quality =
    Number(row.completeness_score) +
    Number(row.isolation_score) +
    Number(row.production_score) +
    Number(row.portability_score) +
    Number(row.maintainability_score);


  const qualityScore =
    quality * 2.4;


  const confidenceScore =
    Number(row.confidence) *
    0.25;


  const reuseMode =
    String(row.reuse_mode);


  const reuseBonus =
    reuseMode === "REUSE_AS_IS"
      ? 10
      : reuseMode === "ADAPT"
        ? 6
        : reuseMode === "REFERENCE_ONLY"
          ? 1
          : -20;


  const security =
    String(row.security_status);


  /*
   * Repository-level audit is only a ranking signal.
   * It is not proof that this implementation itself
   * contains the vulnerability.
   */
  const securityAdjustment =
    security === "PASS"
      ? 5
      : security === "WARNING"
        ? 1
        : security === "UNKNOWN"
          ? 0
          : -2;


  /*
   * similarity_score is stored normalized
   * in PostgreSQL as numeric(5,4): 0..1.
   * Maximum ranking contribution = 5 points.
   */
  const similarityAdjustment =
    Number(row.similarity_score) *
    5;


  return (
    qualityScore +
    confidenceScore +
    reuseBonus +
    securityAdjustment +
    similarityAdjustment
  );
}


export async function recomputePreferredCandidates(): Promise<void> {
  const capabilityResult =
    await appDb.query(
      `
        SELECT
          id::text
        FROM app.implementation_capabilities
        WHERE status = 'ACTIVE'
          AND admin_status <> 'IGNORED'
          AND preferred_source = 'AUTO'
      `,
    );


  for (
    const capability
    of capabilityResult.rows
  ) {
    const members =
      await appDb.query(
        `
          SELECT
            c.id::text,
            c.reuse_mode,
            c.confidence,
            c.security_status,

            c.completeness_score,
            c.isolation_score,
            c.production_score,
            c.portability_score,
            c.maintainability_score,

            m.similarity_score

          FROM app.implementation_capability_members m

          JOIN app.implementation_candidates c
            ON c.id = m.candidate_id

          WHERE m.capability_id = $1
            AND c.admin_status <> 'IGNORED'
            AND c.reuse_mode <> 'NOT_SUITABLE'
        `,
        [
          capability.id,
        ],
      );


    if (
      members.rows.length === 0
    ) {
      continue;
    }


    const ranked =
      members.rows
        .map(
          row => ({
            id:
              String(row.id),

            score:
              candidateRankScore(
                row,
              ),
          }),
        )
        .sort(
          (
            a,
            b,
          ) =>
            b.score -
            a.score,
        );


    await appDb.query(
      `
        UPDATE app.implementation_capabilities
        SET
          preferred_candidate_id = $2,
          updated_at = now()
        WHERE id = $1
      `,
      [
        capability.id,
        ranked[0].id,
      ],
    );
  }
}


export async function listCapabilityReviewQueue() {
  const result =
    await appDb.query(
      `
        SELECT
          cap.id::text,
          cap.canonical_key,
          cap.name,
          cap.category,
          cap.admin_status,
          cap.security_review_status,
          cap.preferred_candidate_id::text,

          COUNT(m.candidate_id)::integer AS candidate_count,

          pc.name AS preferred_candidate_name,
          r.repository_name AS preferred_repository,
          pc.reuse_mode,
          pc.security_status,
          pc.confidence,
          pc.overall_score

        FROM app.implementation_capabilities cap

        LEFT JOIN app.implementation_capability_members m
          ON m.capability_id = cap.id

        LEFT JOIN app.implementation_candidates pc
          ON pc.id = cap.preferred_candidate_id

        LEFT JOIN app.implementation_repositories r
          ON r.id = pc.repository_id

        WHERE cap.status = 'ACTIVE'

        GROUP BY
          cap.id,
          pc.id,
          r.repository_name

        ORDER BY
          cap.admin_status,
          candidate_count DESC,
          cap.canonical_key
      `,
    );

  return result.rows;
}


export async function approveCapability(
  input: {
    canonicalKey: string;

    preferredCandidateId?: string;

    securityReview:
      "PASS" |
      "PASS_WITH_NOTES";

    notes?: string;
  },
): Promise<void> {
  const capability =
    await appDb.query(
      `
        SELECT
          id::text,
          preferred_candidate_id::text
        FROM app.implementation_capabilities
        WHERE canonical_key = $1
      `,
      [
        input.canonicalKey,
      ],
    );


  const row =
    capability.rows[0];


  if (!row) {
    throw new Error(
      `Capability not found: ${input.canonicalKey}`,
    );
  }


  const preferredCandidateId =
    input.preferredCandidateId ??
    row.preferred_candidate_id;


  if (!preferredCandidateId) {
    throw new Error(
      `Capability has no preferred candidate: ${input.canonicalKey}`,
    );
  }


  const member =
    await appDb.query(
      `
        SELECT 1
        FROM app.implementation_capability_members
        WHERE capability_id = $1
          AND candidate_id = $2
      `,
      [
        row.id,
        preferredCandidateId,
      ],
    );


  if (
    member.rowCount !== 1
  ) {
    throw new Error(
      "Preferred candidate is not a member of this capability",
    );
  }


  await appDb.query(
    `
      UPDATE app.implementation_capabilities
      SET
        admin_status = 'APPROVED',
        preferred_candidate_id = $2,
        security_review_status = $3,
        admin_notes = $4,
        updated_at = now()
      WHERE id = $1
    `,
    [
      row.id,
      preferredCandidateId,
      input.securityReview,
      input.notes ??
        null,
    ],
  );
}


export async function ignoreCapability(
  canonicalKey: string,
): Promise<void> {
  await appDb.query(
    `
      UPDATE app.implementation_capabilities
      SET
        admin_status = 'IGNORED',
        updated_at = now()
      WHERE canonical_key = $1
    `,
    [
      canonicalKey,
    ],
  );
}
