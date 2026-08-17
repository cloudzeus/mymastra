import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  validateSoftOneEvidence,
} from "./evidence-registry";

import type {
  SoftOneEvidenceRecord,
  SoftOneEvidenceStatus,
} from "./evidence-types";

import type {
  SoftOneProductArea,
} from "./source-types";

export interface SoftOneEvidenceCatalogFile {
  formatVersion: number;

  updatedAt:
    | string
    | null;

  records:
    SoftOneEvidenceRecord[];
}

export interface SoftOneEvidenceCatalogSearchOptions {
  query?: string;

  status?:
    SoftOneEvidenceStatus;

  kind?:
    SoftOneEvidenceRecord["kind"];

  scope?:
    SoftOneEvidenceRecord["scope"];

  tenantCode?: string;

  softOneVersion?: string;

  productArea?:
    SoftOneProductArea;

  sourceId?: string;

  limit?: number;
}

export interface SoftOneEvidenceCatalogWriteResult {
  success: boolean;

  record?:
    SoftOneEvidenceRecord;

  effectiveStatus?:
    SoftOneEvidenceStatus;

  errors: string[];

  warnings: string[];
}

const DEFAULT_CATALOG_PATH =
  resolve(
    process.cwd(),
    "data/softone-evidence-catalog.json",
  );

function normalize(
  value:
    | string
    | undefined,
): string {
  return (
    value ?? ""
  )
    .trim()
    .toUpperCase();
}

function tokenize(
  value: string,
): string[] {
  return value
    .toLowerCase()
    .split(
      /[^a-zA-Z0-9Α-Ωα-ωάέήίόύώϊϋΐΰ]+/u,
    )
    .map(token => token.trim())
    .filter(Boolean);
}

function catalogPath():
  string {
  return (
    process.env
      .SOFTONE_EVIDENCE_CATALOG_PATH ??
    DEFAULT_CATALOG_PATH
  );
}

export function loadSoftOneEvidenceCatalog():
  SoftOneEvidenceCatalogFile {
  const path =
    catalogPath();

  if (!existsSync(path)) {
    return {
      formatVersion: 1,
      updatedAt: null,
      records: [],
    };
  }

  const parsed =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    ) as
      SoftOneEvidenceCatalogFile;

  return {
    formatVersion:
      parsed.formatVersion ?? 1,

    updatedAt:
      parsed.updatedAt ?? null,

    records:
      Array.isArray(
        parsed.records,
      )
        ? parsed.records
        : [],
  };
}

function saveSoftOneEvidenceCatalog(
  catalog:
    SoftOneEvidenceCatalogFile,
): void {
  const path =
    catalogPath();

  writeFileSync(
    path,
    JSON.stringify(
      {
        ...catalog,
        updatedAt:
          new Date()
            .toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

export function getSoftOneEvidenceRecord(
  id: string,
):
  | SoftOneEvidenceRecord
  | undefined {
  const catalog =
    loadSoftOneEvidenceCatalog();

  const normalizedId =
    normalize(id);

  return catalog.records.find(
    record =>
      normalize(record.id) ===
      normalizedId,
  );
}

function evidenceSearchScore(
  record:
    SoftOneEvidenceRecord,
  query:
    string,
): number {
  const normalizedQuery =
    query
      .trim()
      .toLowerCase();

  if (!normalizedQuery) {
    return 1;
  }

  const tokens =
    tokenize(normalizedQuery);

  const id =
    record.id.toLowerCase();

  const claim =
    record.claim.toLowerCase();

  const tags =
    (
      record.tags ??
      []
    )
      .join(" ")
      .toLowerCase();

  const conditions =
    (
      record.conditions ??
      []
    )
      .join(" ")
      .toLowerCase();

  const sourceText =
    record.sources
      .map(source =>
        [
          source.sourceId,
          source.sourceTitle ?? "",
          source.section ?? "",
          source.notes?.join(" ") ?? "",
        ].join(" "),
      )
      .join(" ")
      .toLowerCase();

  let score = 0;

  if (
    id === normalizedQuery
  ) {
    score += 1000;
  }

  if (
    claim === normalizedQuery
  ) {
    score += 800;
  }

  if (
    claim.includes(
      normalizedQuery,
    )
  ) {
    score += 400;
  }

  for (
    const token of tokens
  ) {
    if (
      id.includes(token)
    ) {
      score += 100;
    }

    if (
      claim.includes(token)
    ) {
      score += 80;
    }

    if (
      tags.includes(token)
    ) {
      score += 40;
    }

    if (
      conditions.includes(token)
    ) {
      score += 30;
    }

    if (
      sourceText.includes(token)
    ) {
      score += 20;
    }
  }

  if (
    record.status ===
    "VERIFIED"
  ) {
    score += 10;
  }

  return score;
}

export function searchSoftOneEvidenceCatalog(
  options:
    SoftOneEvidenceCatalogSearchOptions,
):
  SoftOneEvidenceRecord[] {
  const catalog =
    loadSoftOneEvidenceCatalog();

  const query =
    options.query?.trim() ??
    "";

  const limit =
    Math.max(
      1,
      Math.min(
        options.limit ?? 20,
        100,
      ),
    );

  return catalog.records
    .filter(record => {
      if (
        options.status &&
        record.status !==
          options.status
      ) {
        return false;
      }

      if (
        options.kind &&
        record.kind !==
          options.kind
      ) {
        return false;
      }

      if (
        options.scope &&
        record.scope !==
          options.scope
      ) {
        return false;
      }

      if (
        options.tenantCode &&
        normalize(
          record.tenantCode,
        ) !==
          normalize(
            options.tenantCode,
          )
      ) {
        return false;
      }

      if (
        options.softOneVersion &&
        normalize(
          record.softOneVersion,
        ) !==
          normalize(
            options.softOneVersion,
          )
      ) {
        return false;
      }

      if (
        options.productArea &&
        !record.productAreas.includes(
          options.productArea,
        )
      ) {
        return false;
      }

      if (
        options.sourceId &&
        !record.sources.some(
          source =>
            normalize(
              source.sourceId,
            ) ===
            normalize(
              options.sourceId,
            ),
        )
      ) {
        return false;
      }

      if (
        query &&
        evidenceSearchScore(
          record,
          query,
        ) <= 0
      ) {
        return false;
      }

      return true;
    })
    .map(record => ({
      record,
      score:
        evidenceSearchScore(
          record,
          query,
        ),
    }))
    .sort(
      (
        a,
        b,
      ) =>
        b.score -
        a.score ||
        a.record.id.localeCompare(
          b.record.id,
        ),
    )
    .slice(
      0,
      limit,
    )
    .map(
      result =>
        result.record,
    );
}

export function upsertSoftOneEvidenceRecord(
  input:
    SoftOneEvidenceRecord,
):
  SoftOneEvidenceCatalogWriteResult {
  const validation =
    validateSoftOneEvidence(
      input,
    );

  if (
    !validation.valid
  ) {
    return {
      success: false,
      errors:
        validation.errors,
      warnings:
        validation.warnings,
      effectiveStatus:
        validation.effectiveStatus,
    };
  }

  const catalog =
    loadSoftOneEvidenceCatalog();

  const normalizedId =
    normalize(input.id);

  const now =
    new Date()
      .toISOString();

  const existingIndex =
    catalog.records.findIndex(
      record =>
        normalize(record.id) ===
        normalizedId,
    );

  const existing =
    existingIndex >= 0
      ? catalog.records[
          existingIndex
        ]
      : undefined;

  const record:
    SoftOneEvidenceRecord = {
    ...existing,
    ...input,

    id:
      normalizedId,

    status:
      validation.effectiveStatus,

    createdAt:
      existing?.createdAt ??
      input.createdAt ??
      now,

    updatedAt:
      now,
  };

  if (
    existingIndex >= 0
  ) {
    catalog.records[
      existingIndex
    ] = record;
  } else {
    catalog.records.push(
      record,
    );
  }

  catalog.records.sort(
    (
      a,
      b,
    ) =>
      a.id.localeCompare(
        b.id,
      ),
  );

  saveSoftOneEvidenceCatalog(
    catalog,
  );

  return {
    success: true,
    record,
    effectiveStatus:
      validation.effectiveStatus,
    errors: [],
    warnings:
      validation.warnings,
  };
}


export interface SoftOneEvidenceCatalogBatchWriteResult {
  success: boolean;

  inserted: number;

  updated: number;

  records: SoftOneEvidenceRecord[];

  errors: Array<{
    id: string;
    errors: string[];
  }>;

  warnings: Array<{
    id: string;
    warnings: string[];
  }>;
}


export function upsertSoftOneEvidenceRecords(
  inputs:
    readonly SoftOneEvidenceRecord[],
):
  SoftOneEvidenceCatalogBatchWriteResult {
  const seen =
    new Set<string>();

  const duplicateErrors:
    Array<{
      id: string;
      errors: string[];
    }> = [];

  for (
    const input of inputs
  ) {
    const normalizedId =
      normalize(input.id);

    if (
      seen.has(normalizedId)
    ) {
      duplicateErrors.push({
        id:
          normalizedId,

        errors: [
          "Duplicate evidence id in batch input.",
        ],
      });
    }

    seen.add(
      normalizedId,
    );
  }

  if (
    duplicateErrors.length > 0
  ) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      records: [],
      errors:
        duplicateErrors,
      warnings: [],
    };
  }

  const validated =
    inputs.map(input => ({
      input,

      validation:
        validateSoftOneEvidence(
          input,
        ),
    }));

  const errors =
    validated
      .filter(
        item =>
          !item.validation.valid,
      )
      .map(item => ({
        id:
          normalize(
            item.input.id,
          ),

        errors:
          item.validation.errors,
      }));

  const warnings =
    validated
      .filter(
        item =>
          item.validation
            .warnings.length > 0,
      )
      .map(item => ({
        id:
          normalize(
            item.input.id,
          ),

        warnings:
          item.validation.warnings,
      }));

  /*
   * Do not mutate the catalog at all unless
   * every incoming record validates.
   */
  if (
    errors.length > 0
  ) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      records: [],
      errors,
      warnings,
    };
  }

  const catalog =
    loadSoftOneEvidenceCatalog();

  const nextRecords =
    [...catalog.records];

  const indexById =
    new Map<string, number>();

  nextRecords.forEach(
    (
      record,
      index,
    ) => {
      indexById.set(
        normalize(record.id),
        index,
      );
    },
  );

  const now =
    new Date()
      .toISOString();

  let inserted = 0;
  let updated = 0;

  const written:
    SoftOneEvidenceRecord[] = [];

  for (
    const {
      input,
      validation,
    } of validated
  ) {
    const normalizedId =
      normalize(input.id);

    const existingIndex =
      indexById.get(
        normalizedId,
      );

    const existing =
      existingIndex === undefined
        ? undefined
        : nextRecords[
            existingIndex
          ];

    const record:
      SoftOneEvidenceRecord = {
      ...existing,
      ...input,

      id:
        normalizedId,

      status:
        validation.effectiveStatus,

      createdAt:
        existing?.createdAt ??
        input.createdAt ??
        now,

      updatedAt:
        now,
    };

    if (
      existingIndex === undefined
    ) {
      nextRecords.push(
        record,
      );

      indexById.set(
        normalizedId,
        nextRecords.length - 1,
      );

      inserted += 1;
    } else {
      nextRecords[
        existingIndex
      ] = record;

      updated += 1;
    }

    written.push(
      record,
    );
  }

  nextRecords.sort(
    (
      a,
      b,
    ) =>
      a.id.localeCompare(
        b.id,
      ),
  );

  catalog.records =
    nextRecords;

  saveSoftOneEvidenceCatalog(
    catalog,
  );

  return {
    success: true,
    inserted,
    updated,
    records:
      written,
    errors: [],
    warnings,
  };
}


export function removeSoftOneEvidenceRecord(
  id: string,
): boolean {
  const catalog =
    loadSoftOneEvidenceCatalog();

  const normalizedId =
    normalize(id);

  const nextRecords =
    catalog.records.filter(
      record =>
        normalize(record.id) !==
        normalizedId,
    );

  if (
    nextRecords.length ===
    catalog.records.length
  ) {
    return false;
  }

  catalog.records =
    nextRecords;

  saveSoftOneEvidenceCatalog(
    catalog,
  );

  return true;
}

export function getSoftOneEvidenceCatalogStats() {
  const catalog =
    loadSoftOneEvidenceCatalog();

  const byStatus:
    Record<
      string,
      number
    > = {};

  const byKind:
    Record<
      string,
      number
    > = {};

  const bySource:
    Record<
      string,
      number
    > = {};

  for (
    const record of
      catalog.records
  ) {
    byStatus[
      record.status
    ] =
      (
        byStatus[
          record.status
        ] ?? 0
      ) + 1;

    byKind[
      record.kind
    ] =
      (
        byKind[
          record.kind
        ] ?? 0
      ) + 1;

    for (
      const source of
        record.sources
    ) {
      bySource[
        source.sourceId
      ] =
        (
          bySource[
            source.sourceId
          ] ?? 0
        ) + 1;
    }
  }

  return {
    formatVersion:
      catalog.formatVersion,

    updatedAt:
      catalog.updatedAt,

    total:
      catalog.records.length,

    byStatus,

    byKind,

    bySource,
  };
}
