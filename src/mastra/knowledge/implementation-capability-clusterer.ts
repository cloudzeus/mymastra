import {
  analystAgent,
} from "../agents/analyst";

import {
  assignCandidateToCapability,
  listCapabilityDictionary,
  listUnclusteredCandidates,
  recomputePreferredCandidates,
} from "./implementation-capability-manager";


function extractJson(
  text: string,
): unknown {
  const trimmed =
    text.trim();

  try {
    return JSON.parse(
      trimmed,
    );
  }
  catch {
    // continue
  }


  const fenced =
    trimmed.match(
      /```(?:json)?\s*([\s\S]*?)```/i,
    );

  if (
    fenced?.[1]
  ) {
    return JSON.parse(
      fenced[1],
    );
  }


  const first =
    trimmed.indexOf(
      "{",
    );

  const last =
    trimmed.lastIndexOf(
      "}",
    );


  if (
    first >= 0 &&
    last > first
  ) {
    return JSON.parse(
      trimmed.slice(
        first,
        last + 1,
      ),
    );
  }


  throw new Error(
    "Capability clusterer returned invalid JSON",
  );
}


function validCanonicalKey(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^[A-Z][A-Z0-9_]{2,100}$/.test(
      value,
    )
  );
}


function strings(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (
          item,
        ): item is string =>
          typeof item === "string",
      ),
    ),
  ];
}


export async function clusterNextImplementationBatch(
  batchSize = 20,
): Promise<{
  processed: number;
  assigned: number;
}> {
  const candidates =
    await listUnclusteredCandidates(
      batchSize,
    );


  if (
    candidates.length === 0
  ) {
    return {
      processed: 0,
      assigned: 0,
    };
  }


  const dictionary =
    await listCapabilityDictionary();


  const compactCandidates =
    candidates.map(
      candidate => ({
        id:
          candidate.id,

        repository:
          candidate.repositoryName,

        name:
          candidate.name,

        category:
          candidate.category,

        problemSolved:
          candidate.problemSolved,

        tags:
          candidate.tags,

        technologies:
          candidate.technologies,

        reusableParts:
          candidate.reusableParts,

        reuseMode:
          candidate.reuseMode,
      }),
    );


  const response =
    await analystAgent.generate(
      [
        {
          role:
            "user" as const,

          content:
            [
              "INTERNAL IMPLEMENTATION CAPABILITY CLUSTERING.",
              "",
              "Do not call tools.",
              "Do not inspect repositories.",
              "Do not perform external research.",
              "",
              "Each implementation candidate must be assigned to exactly ONE primary canonical capability.",
              "",
              "The capability represents WHAT reusable technical capability is implemented, not the customer, repository, product or project.",
              "",
              "IMPORTANT:",
              "- Reuse an EXISTING canonicalKey whenever it means substantially the same capability.",
              "- Create a new canonicalKey only when no existing capability fits.",
              "- canonicalKey MUST be stable UPPER_SNAKE_CASE.",
              "- Do NOT merge materially different capabilities merely because they use the same vendor.",
              "",
              "Examples:",
              "SoftOne API client → SOFTONE_WEB_SERVICES_CLIENT",
              "SoftOne customer/item sync → SOFTONE_MASTER_DATA_SYNC",
              "SoftOne document creation → SOFTONE_DOCUMENT_AUTOMATION",
              "SoftOne schema discovery → SOFTONE_METADATA_DISCOVERY",
              "generic webhook ingestion → WEBHOOK_INGESTION_PIPELINE",
              "Bunny storage adapter → BUNNY_STORAGE_ADAPTER",
              "Excel mapping/import → EXCEL_IMPORT_PIPELINE",
              "DB-backed cron locking → DATABASE_JOB_LOCKING",
              "",
              "Do NOT collapse all SoftOne implementations into one capability.",
              "",
              "similarityScore is integer 0..100 and describes how directly the candidate implements the selected canonical capability.",
              "confidence is integer 0..100.",
              "",
              "Return ONLY valid JSON:",
              "{",
              '  "assignments": [',
              "    {",
              '      "candidateId": "uuid",',
              '      "canonicalKey": "UPPER_SNAKE_CASE",',
              '      "name": "human readable capability name",',
              '      "description": "vendor/domain-neutral where appropriate",',
              '      "category": "string",',
              '      "tags": ["string"],',
              '      "similarityScore": 0,',
              '      "confidence": 0',
              "    }",
              "  ]",
              "}",
              "",
              "EXISTING CAPABILITIES:",
              JSON.stringify(
                dictionary,
                null,
                2,
              ),
              "",
              "IMPLEMENTATION CANDIDATES:",
              JSON.stringify(
                compactCandidates,
                null,
                2,
              ),
            ].join(
              "\n",
            ),
        },
      ],
      {
        toolChoice:
          "none",

        maxSteps:
          1,

        abortSignal:
          AbortSignal.timeout(
            120_000,
          ),
      },
    );


  const payload =
    extractJson(
      response.text ??
      "",
    );


  if (
    typeof payload !== "object" ||
    payload === null
  ) {
    throw new Error(
      "Capability clusterer response is not an object",
    );
  }


  const assignments =
    (
      payload as Record<
        string,
        unknown
      >
    ).assignments;


  if (
    !Array.isArray(
      assignments,
    )
  ) {
    throw new Error(
      "Capability clusterer response has no assignments array",
    );
  }


  const allowedCandidateIds =
    new Set(
      candidates.map(
        candidate =>
          candidate.id,
      ),
    );


  let assigned =
    0;


  for (
    const raw
    of assignments
  ) {
    if (
      typeof raw !== "object" ||
      raw === null
    ) {
      continue;
    }


    const item =
      raw as Record<
        string,
        unknown
      >;


    const candidateId =
      typeof item.candidateId === "string"
        ? item.candidateId
        : "";


    if (
      !allowedCandidateIds.has(
        candidateId,
      )
    ) {
      continue;
    }


    if (
      !validCanonicalKey(
        item.canonicalKey,
      )
    ) {
      continue;
    }


    const name =
      typeof item.name === "string"
        ? item.name.trim()
        : "";


    const description =
      typeof item.description === "string"
        ? item.description.trim()
        : "";


    const category =
      typeof item.category === "string"
        ? item.category.trim()
        : "";


    if (
      !name ||
      !description ||
      !category
    ) {
      continue;
    }


    await assignCandidateToCapability({
      candidateId,

      canonicalKey:
        item.canonicalKey,

      name,

      description,

      category,

      tags:
        strings(
          item.tags,
        ),

      similarityScore:
        Number(
          item.similarityScore ??
          0,
        ),

      confidence:
        Number(
          item.confidence ??
          0,
        ),
    });


    assigned += 1;
  }


  await recomputePreferredCandidates();


  return {
    processed:
      candidates.length,

    assigned,
  };
}
