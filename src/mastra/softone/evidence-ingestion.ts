import {
  getSoftOneEvidenceRecord,
  searchSoftOneEvidenceCatalog,
  upsertSoftOneEvidenceRecord,
} from "./evidence-catalog";

import {
  getSoftOneSource,
} from "./source-registry";

import type {
  SoftOneEvidenceRecord,
  SoftOneEvidenceStatus,
} from "./evidence-types";

import type {
  SoftOneIngestionCandidate,
} from "./ingestion-types";

export type SoftOneCorroborationLevel =
  | "NONE"
  | "SAME_SOURCE"
  | "MULTI_SOURCE"
  | "AUTHORITATIVE";

export interface SoftOneIngestionDecision {
  success: boolean;

  action:
    | "INSERTED"
    | "UPDATED"
    | "DUPLICATE"
    | "REJECTED"
    | "NEEDS_REVIEW";

  candidateId: string;

  evidenceId: string;

  effectiveStatus:
    SoftOneEvidenceStatus;

  corroboration:
    SoftOneCorroborationLevel;

  matchedEvidenceIds:
    string[];

  errors: string[];

  warnings: string[];

  notes: string[];
}

function normalize(
  value: string | undefined,
): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeClaim(
  value: string,
): string {
  return normalize(value)
    .replace(/[.,;:!?()[\]{}"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceIds(
  record: SoftOneEvidenceRecord,
): string[] {
  return [
    ...new Set(
      record.sources.map(
        source =>
          source.sourceId,
      ),
    ),
  ];
}

function hasAuthoritativeSource(
  record: SoftOneEvidenceRecord,
): boolean {
  return record.sources.some(
    reference => {
      const source =
        getSoftOneSource(
          reference.sourceId,
        );

      if (!source) {
        return false;
      }

      return [
        "OFFICIAL_DOCUMENTATION",
        "OFFICIAL_TRAINING",
        "TENANT_VERIFIED",
        "USER_VERIFIED",
        "CANONICAL_INTERNAL",
      ].includes(
        source.authority,
      );
    },
  );
}

function sameClaim(
  a: SoftOneEvidenceRecord,
  b: SoftOneEvidenceRecord,
): boolean {
  return (
    normalizeClaim(a.claim) ===
    normalizeClaim(b.claim)
  );
}

function overlappingSources(
  a: SoftOneEvidenceRecord,
  b: SoftOneEvidenceRecord,
): string[] {
  const bSources =
    new Set(
      sourceIds(b),
    );

  return sourceIds(a).filter(
    source =>
      bSources.has(source),
  );
}

function findPotentialMatches(
  record: SoftOneEvidenceRecord,
): SoftOneEvidenceRecord[] {
  /*
   * First use lexical catalog search to avoid
   * scanning conceptually unrelated evidence.
   */
  const results =
    searchSoftOneEvidenceCatalog({
      query:
        record.claim,
      limit: 100,
    });

  return results.filter(
    existing =>
      existing.id !==
        record.id &&
      (
        sameClaim(
          existing,
          record,
        ) ||
        normalizeClaim(
          existing.claim,
        ).includes(
          normalizeClaim(
            record.claim,
          ),
        ) ||
        normalizeClaim(
          record.claim,
        ).includes(
          normalizeClaim(
            existing.claim,
          ),
        )
      ),
  );
}

function determineCorroboration(
  record:
    SoftOneEvidenceRecord,
  matches:
    SoftOneEvidenceRecord[],
): SoftOneCorroborationLevel {
  if (
    hasAuthoritativeSource(
      record,
    )
  ) {
    return "AUTHORITATIVE";
  }

  if (
    matches.some(
      match =>
        hasAuthoritativeSource(
          match,
        ),
    )
  ) {
    return "AUTHORITATIVE";
  }

  const currentSources =
    new Set(
      sourceIds(record),
    );

  const allSourceIds =
    new Set(
      sourceIds(record),
    );

  for (
    const match of matches
  ) {
    for (
      const sourceId of
        sourceIds(match)
    ) {
      allSourceIds.add(
        sourceId,
      );
    }
  }

  if (
    allSourceIds.size >
    currentSources.size
  ) {
    return "MULTI_SOURCE";
  }

  if (
    matches.length > 0
  ) {
    return "SAME_SOURCE";
  }

  return "NONE";
}

function mergeEvidenceRecords(
  existing:
    SoftOneEvidenceRecord,
  incoming:
    SoftOneEvidenceRecord,
): SoftOneEvidenceRecord {
  const sources =
    [
      ...existing.sources,
    ];

  for (
    const source of
      incoming.sources
  ) {
    const exists =
      sources.some(
        current =>
          current.sourceId ===
            source.sourceId &&
          current.sourceUrl ===
            source.sourceUrl &&
          current.sourceTitle ===
            source.sourceTitle &&
          current.section ===
            source.section &&
          current.page ===
            source.page &&
          current.timestampSeconds ===
            source.timestampSeconds,
      );

    if (!exists) {
      sources.push(
        source,
      );
    }
  }

  const uniqueStrings = (
    values:
      | string[]
      | undefined,
  ): string[] | undefined => {
    if (!values) {
      return undefined;
    }

    return [
      ...new Set(
        values.filter(
          Boolean,
        ),
      ),
    ];
  };

  return {
    ...existing,

    sources,

    dependsOn:
      uniqueStrings([
        ...(existing.dependsOn ?? []),
        ...(incoming.dependsOn ?? []),
      ]),

    conditions:
      uniqueStrings([
        ...(existing.conditions ?? []),
        ...(incoming.conditions ?? []),
      ]),

    limitations:
      uniqueStrings([
        ...(existing.limitations ?? []),
        ...(incoming.limitations ?? []),
      ]),

    verificationNotes:
      uniqueStrings([
        ...(existing.verificationNotes ?? []),
        ...(incoming.verificationNotes ?? []),
      ]),

    tags:
      uniqueStrings([
        ...(existing.tags ?? []),
        ...(incoming.tags ?? []),
      ]),
  };
}

function suggestedStatus(
  record:
    SoftOneEvidenceRecord,
  corroboration:
    SoftOneCorroborationLevel,
): SoftOneEvidenceStatus {
  /*
   * IMPORTANT:
   *
   * Ingestion NEVER promotes automatically
   * to VERIFIED.
   *
   * AUTHORITATIVE means the record has evidence
   * that may be capable of verification, but
   * claim-category validation still belongs to
   * the evidence policy/validator.
   */

  if (
    record.status ===
    "VERIFIED"
  ) {
    return "VERIFIED";
  }

  if (
    corroboration ===
      "AUTHORITATIVE" ||
    corroboration ===
      "MULTI_SOURCE" ||
    corroboration ===
      "SAME_SOURCE"
  ) {
    return "DERIVED";
  }

  return record.status;
}

export function ingestSoftOneEvidenceCandidate(
  candidate:
    SoftOneIngestionCandidate,
): SoftOneIngestionDecision {
  const errors:
    string[] = [];

  const warnings:
    string[] = [];

  const notes:
    string[] = [];

  if (
    candidate.status ===
    "REJECTED"
  ) {
    return {
      success: false,
      action:
        "REJECTED",
      candidateId:
        candidate.id,
      evidenceId:
        candidate.evidence.id,
      effectiveStatus:
        candidate.evidence.status,
      corroboration:
        "NONE",
      matchedEvidenceIds: [],
      errors: [
        "Candidate status is REJECTED.",
      ],
      warnings: [],
      notes: [],
    };
  }

  if (
    candidate.status ===
      "NEEDS_REVIEW" ||
    candidate.extraction
      .requiresHumanReview
  ) {
    return {
      success: false,
      action:
        "NEEDS_REVIEW",
      candidateId:
        candidate.id,
      evidenceId:
        candidate.evidence.id,
      effectiveStatus:
        candidate.evidence.status,
      corroboration:
        "NONE",
      matchedEvidenceIds: [],
      errors: [],
      warnings: [
        "Candidate requires human review before ingestion.",
      ],
      notes:
        candidate.extraction.reason,
    };
  }

  const incoming =
    candidate.evidence;

  const exactExisting =
    getSoftOneEvidenceRecord(
      incoming.id,
    );

  const potentialMatches =
    findPotentialMatches(
      incoming,
    );

  const corroboration =
    determineCorroboration(
      incoming,
      potentialMatches,
    );

  const matchedEvidenceIds =
    potentialMatches.map(
      match => match.id,
    );

  /*
   * Exact same evidence ID.
   */
  if (exactExisting) {
    const merged =
      mergeEvidenceRecords(
        exactExisting,
        incoming,
      );

    merged.status =
      suggestedStatus(
        merged,
        corroboration,
      );

    const write =
      upsertSoftOneEvidenceRecord(
        merged,
      );

    return {
      success:
        write.success,

      action:
        sameClaim(
          exactExisting,
          incoming,
        )
          ? "DUPLICATE"
          : "UPDATED",

      candidateId:
        candidate.id,

      evidenceId:
        incoming.id,

      effectiveStatus:
        write.effectiveStatus ??
        merged.status,

      corroboration,

      matchedEvidenceIds,

      errors:
        write.errors,

      warnings:
        write.warnings,

      notes: [
        "Existing evidence ID found.",
        "Sources and metadata were merged safely.",
      ],
    };
  }

  /*
   * Semantically equivalent claim already exists
   * under another ID.
   *
   * Do not silently merge IDs because two records
   * may have different scope/version/source context.
   */
  const equivalent =
    potentialMatches.find(
      existing =>
        sameClaim(
          existing,
          incoming,
        ),
    );

  if (equivalent) {
    warnings.push(
      `Equivalent claim already exists as ${equivalent.id}.`,
    );

    notes.push(
      "Candidate retained as separate evidence because provenance or scope may differ.",
    );
  }

  const record:
    SoftOneEvidenceRecord = {
    ...incoming,

    status:
      suggestedStatus(
        incoming,
        corroboration,
      ),

    verificationNotes: [
      ...(
        incoming.verificationNotes ??
        []
      ),

      `Ingestion corroboration level: ${corroboration}`,

      ...(matchedEvidenceIds.length
        ? [
            `Potential corroborating evidence: ${matchedEvidenceIds.join(", ")}`,
          ]
        : []),
    ],
  };

  const write =
    upsertSoftOneEvidenceRecord(
      record,
    );

  return {
    success:
      write.success,

    action:
      write.success
        ? "INSERTED"
        : "REJECTED",

    candidateId:
      candidate.id,

    evidenceId:
      record.id,

    effectiveStatus:
      write.effectiveStatus ??
      record.status,

    corroboration,

    matchedEvidenceIds,

    errors: [
      ...errors,
      ...write.errors,
    ],

    warnings: [
      ...warnings,
      ...write.warnings,
    ],

    notes,
  };
}
