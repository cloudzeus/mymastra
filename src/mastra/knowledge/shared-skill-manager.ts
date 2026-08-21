import {
  appDb,
} from "../db/postgres";


function slugify(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /_/g,
      "-",
    )
    .replace(
      /[^a-z0-9-]+/g,
      "-",
    )
    .replace(
      /-+/g,
      "-",
    )
    .replace(
      /^-|-$/g,
      "",
    );
}


function parseRepositoryProfile(
  value: unknown,
): {
  stack: string[];
  packageVersions:
    Record<string, string>;
} {
  if (
    typeof value !== "string"
  ) {
    return {
      stack: [],
      packageVersions: {},
    };
  }


  try {
    const parsed =
      JSON.parse(
        value,
      );

    return {
      stack:
        Array.isArray(
          parsed.stack,
        )
          ? parsed.stack
          : [],

      packageVersions:
        parsed.packageVersions &&
        typeof parsed.packageVersions === "object"
          ? parsed.packageVersions
          : {},
    };
  }
  catch {
    return {
      stack: [],
      packageVersions: {},
    };
  }
}


export async function promoteCapabilityToSharedSkill(
  canonicalKey: string,
) {
  const result =
    await appDb.query(
      `
        SELECT
          cap.id::text AS capability_id,
          cap.canonical_key,
          cap.name AS capability_name,
          cap.description AS capability_description,
          cap.security_review_status,

          c.id::text AS candidate_id,
          c.name AS candidate_name,
          c.description AS candidate_description,
          c.dependencies,
          c.reuse_guidance,
          c.source_commit,

          r.summary AS repository_summary

        FROM app.implementation_capabilities cap

        JOIN app.implementation_candidates c
          ON c.id = cap.preferred_candidate_id

        JOIN app.implementation_repositories r
          ON r.id = c.repository_id

        WHERE cap.canonical_key = $1
          AND cap.admin_status = 'APPROVED'
      `,
      [
        canonicalKey,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `Approved capability not found: ${canonicalKey}`,
    );
  }


  if (
    row.security_review_status !== "PASS" &&
    row.security_review_status !== "PASS_WITH_NOTES"
  ) {
    throw new Error(
      `Capability security review is not approved: ${canonicalKey}`,
    );
  }


  const profile =
    parseRepositoryProfile(
      row.repository_summary,
    );


  const slug =
    slugify(
      row.canonical_key,
    );


  const client =
    await appDb.connect();


  try {
    await client.query(
      "BEGIN",
    );


    const skill =
      await client.query(
        `
          INSERT INTO app.shared_skills (
            capability_id,
            preferred_candidate_id,
            slug,
            name,
            description,
            status,
            supported_stacks,
            source_package_versions,
            dependencies,
            usage_instructions,
            examples,
            security_review_status
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'APPROVED',
            $6::jsonb,
            $7::jsonb,
            $8::jsonb,
            $9::jsonb,
            '[]'::jsonb,
            $10
          )

          ON CONFLICT (capability_id)

          DO UPDATE SET
            preferred_candidate_id =
              EXCLUDED.preferred_candidate_id,

            slug =
              EXCLUDED.slug,

            name =
              EXCLUDED.name,

            description =
              EXCLUDED.description,

            status =
              'APPROVED',

            supported_stacks =
              EXCLUDED.supported_stacks,

            source_package_versions =
              EXCLUDED.source_package_versions,

            dependencies =
              EXCLUDED.dependencies,

            usage_instructions =
              EXCLUDED.usage_instructions,

            security_review_status =
              EXCLUDED.security_review_status,

            updated_at =
              now()

          RETURNING id::text
        `,
        [
          row.capability_id,
          row.candidate_id,
          slug,
          row.capability_name,
          row.capability_description,
          JSON.stringify(
            profile.stack,
          ),
          JSON.stringify(
            profile.packageVersions,
          ),
          JSON.stringify(
            row.dependencies ??
            [],
          ),
          JSON.stringify(
            row.reuse_guidance ??
            [],
          ),
          row.security_review_status,
        ],
      );


    const sharedSkillId =
      String(
        skill.rows[0].id,
      );


    await client.query(
      `
        INSERT INTO app.shared_skill_sources (
          shared_skill_id,
          candidate_id,
          source_commit,
          source_role
        )
        VALUES (
          $1,
          $2,
          $3,
          'PRIMARY'
        )

        ON CONFLICT (
          shared_skill_id,
          candidate_id
        )

        DO UPDATE SET
          source_commit =
            EXCLUDED.source_commit,

          source_role =
            'PRIMARY'
      `,
      [
        sharedSkillId,
        row.candidate_id,
        row.source_commit,
      ],
    );


    await client.query(
      "COMMIT",
    );


    return {
      id:
        sharedSkillId,

      slug,

      canonicalKey,
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


export async function listApprovedSharedSkills() {
  const result =
    await appDb.query(
      `
        SELECT
          s.id::text,
          s.slug,
          s.name,
          s.description,
          s.supported_stacks,
          s.source_package_versions,
          s.dependencies,
          s.usage_instructions,

          cap.canonical_key,

          c.id::text AS candidate_id,
          c.name AS implementation_name,

          r.owner,
          r.repository_name,

          src.source_commit

        FROM app.shared_skills s

        JOIN app.implementation_capabilities cap
          ON cap.id = s.capability_id

        JOIN app.implementation_candidates c
          ON c.id = s.preferred_candidate_id

        JOIN app.implementation_repositories r
          ON r.id = c.repository_id

        JOIN app.shared_skill_sources src
          ON src.shared_skill_id = s.id
         AND src.candidate_id = c.id
         AND src.source_role = 'PRIMARY'

        WHERE s.status = 'APPROVED'

        ORDER BY s.slug
      `,
    );


  return result.rows;
}
