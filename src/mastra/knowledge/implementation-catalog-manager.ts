import {
  appDb,
} from "../db/postgres";

import type {
  ImplementationRepository,
} from "./implementation-catalog-types";


type RepositoryRow = {
  id: string;

  provider: string;

  owner: string;

  repository_name: string;

  repository_url: string;

  default_branch:
    string | null;

  scanned_commit:
    string | null;

  status: string;

  detected_stack:
    unknown;

  summary:
    string | null;

  last_scanned_at:
    string | null;

  created_at: string;

  updated_at: string;
};


function strings(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is string =>
      typeof item ===
        "string",
  );
}


function mapRepository(
  row: RepositoryRow,
): ImplementationRepository {
  return {
    id:
      row.id,

    provider:
      "GITHUB",

    owner:
      row.owner,

    repositoryName:
      row.repository_name,

    repositoryUrl:
      row.repository_url,

    defaultBranch:
      row.default_branch ??
      undefined,

    scannedCommit:
      row.scanned_commit ??
      undefined,

    status:
      row.status as
        ImplementationRepository["status"],

    detectedStack:
      strings(
        row.detected_stack,
      ),

    summary:
      row.summary ??
      undefined,

    lastScannedAt:
      row.last_scanned_at ??
      undefined,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


export async function upsertImplementationRepository(
  input: {
    owner: string;

    repositoryName: string;

    repositoryUrl: string;

    defaultBranch?: string;
  },
): Promise<ImplementationRepository> {
  const result =
    await appDb.query<
      RepositoryRow
    >(
      `
        INSERT INTO app.implementation_repositories (
          owner,
          repository_name,
          repository_url,
          default_branch
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
        ON CONFLICT (
          owner,
          repository_name
        )
        DO UPDATE SET
          repository_url =
            EXCLUDED.repository_url,

          default_branch =
            COALESCE(
              EXCLUDED.default_branch,
              app.implementation_repositories.default_branch
            ),

          updated_at =
            now()

        RETURNING
          id::text,
          provider,
          owner,
          repository_name,
          repository_url,
          default_branch,
          scanned_commit,
          status,
          detected_stack,
          summary,
          last_scanned_at::text,
          created_at::text,
          updated_at::text
      `,
      [
        input.owner,
        input.repositoryName,
        input.repositoryUrl,
        input.defaultBranch ??
          null,
      ],
    );

  return mapRepository(
    result.rows[0],
  );
}


export async function listImplementationRepositories(): Promise<
  ImplementationRepository[]
> {
  const result =
    await appDb.query<
      RepositoryRow
    >(
      `
        SELECT
          id::text,
          provider,
          owner,
          repository_name,
          repository_url,
          default_branch,
          scanned_commit,
          status,
          detected_stack,
          summary,
          last_scanned_at::text,
          created_at::text,
          updated_at::text
        FROM app.implementation_repositories
        ORDER BY
          owner,
          repository_name
      `,
    );

  return result.rows.map(
    mapRepository,
  );
}


export async function replaceRepositoryImplementationCandidates(
  input: {
    repositoryId: string;

    candidates: Array<{
      name: string;
      category: string;
      problemSolved: string;
      description?: string;
      tags: string[];
      technologies: string[];
      sourceFiles: string[];
      dependencies: string[];
      customerSpecificDependencies: string[];
      reusableParts: string[];
      nonReusableParts: string[];
      reuseGuidance: string[];
      reuseMode:
        | "REUSE_AS_IS"
        | "ADAPT"
        | "REFERENCE_ONLY"
        | "NOT_SUITABLE";

      completenessScore: number;
      isolationScore: number;
      productionScore: number;
      portabilityScore: number;
      maintainabilityScore: number;

      confidence: number;

      securityStatus:
        | "UNKNOWN"
        | "PASS"
        | "WARNING"
        | "BLOCKED";

      vulnerabilitySummary:
        Record<string, unknown>;

      securityScore: number;
    }>;
  },
): Promise<number> {
  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    /*
     * Bootstrap/mining state is mutable.
     * Admin-approved catalog entries are never
     * removed by an automatic re-mine.
     */
    await client.query(
      `
        DELETE FROM app.implementation_candidates
        WHERE repository_id = $1
          AND admin_status = 'CANDIDATE'
      `,
      [
        input.repositoryId,
      ],
    );

    let inserted =
      0;

    for (
      const candidate
      of input.candidates
    ) {
      await client.query(
        `
          INSERT INTO app.implementation_candidates (
            repository_id,
            name,
            category,
            problem_solved,
            description,

            tags,
            technologies,
            source_files,
            dependencies,
            customer_specific_dependencies,
            reusable_parts,
            non_reusable_parts,
            reuse_guidance,

            reuse_mode,

            completeness_score,
            isolation_score,
            production_score,
            portability_score,
            maintainability_score,

            confidence,

            security_status,
            vulnerability_summary,
            security_score,

            version_compatibility_score,

            admin_status
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,

            $6::jsonb,
            $7::jsonb,
            $8::jsonb,
            $9::jsonb,
            $10::jsonb,
            $11::jsonb,
            $12::jsonb,
            $13::jsonb,

            $14,

            $15,
            $16,
            $17,
            $18,
            $19,

            $20,

            $21,
            $22::jsonb,
            $23,

            0,

            'CANDIDATE'
          )
        `,
        [
          input.repositoryId,

          candidate.name,
          candidate.category,
          candidate.problemSolved,
          candidate.description ??
            null,

          JSON.stringify(
            candidate.tags,
          ),

          JSON.stringify(
            candidate.technologies,
          ),

          JSON.stringify(
            candidate.sourceFiles,
          ),

          JSON.stringify(
            candidate.dependencies,
          ),

          JSON.stringify(
            candidate.customerSpecificDependencies,
          ),

          JSON.stringify(
            candidate.reusableParts,
          ),

          JSON.stringify(
            candidate.nonReusableParts,
          ),

          JSON.stringify(
            candidate.reuseGuidance,
          ),

          candidate.reuseMode,

          candidate.completenessScore,
          candidate.isolationScore,
          candidate.productionScore,
          candidate.portabilityScore,
          candidate.maintainabilityScore,

          candidate.confidence,

          candidate.securityStatus,

          JSON.stringify(
            candidate.vulnerabilitySummary,
          ),

          candidate.securityScore,
        ],
      );

      inserted += 1;
    }

    await client.query(
      "COMMIT",
    );

    return inserted;
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
