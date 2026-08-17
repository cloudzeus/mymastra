import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

export interface SoftOneIngestionStateEntry {
  sourceKey:
    string;

  sourceFingerprint:
    string;

  subject?:
    string;

  lastProcessedAt:
    string;

  evidenceIds:
    string[];

  reviewCount:
    number;
}

export interface SoftOneIngestionStateFile {
  formatVersion:
    number;

  updatedAt:
    | string
    | null;

  sources:
    Record<
      string,
      SoftOneIngestionStateEntry
    >;
}

const DEFAULT_STATE_PATH =
  resolve(
    process.cwd(),
    "data/softone-ingestion-state.json",
  );

function statePath():
  string {
  return (
    process.env
      .SOFTONE_INGESTION_STATE_PATH ??
    DEFAULT_STATE_PATH
  );
}

export function loadSoftOneIngestionState():
  SoftOneIngestionStateFile {
  const path =
    statePath();

  if (!existsSync(path)) {
    return {
      formatVersion: 1,
      updatedAt: null,
      sources: {},
    };
  }

  const parsed =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    ) as SoftOneIngestionStateFile;

  return {
    formatVersion:
      parsed.formatVersion ?? 1,

    updatedAt:
      parsed.updatedAt ?? null,

    sources:
      parsed.sources ?? {},
  };
}

export function getSoftOneIngestionStateEntry(
  sourceKey:
    string,
):
  | SoftOneIngestionStateEntry
  | undefined {
  return loadSoftOneIngestionState()
    .sources[
      sourceKey
    ];
}

export function shouldProcessSoftOneSource(
  sourceKey:
    string,

  sourceFingerprint:
    string,
): boolean {
  const existing =
    getSoftOneIngestionStateEntry(
      sourceKey,
    );

  if (!existing) {
    return true;
  }

  return (
    existing.sourceFingerprint !==
    sourceFingerprint
  );
}

export function updateSoftOneIngestionState(
  entry:
    SoftOneIngestionStateEntry,
): void {
  const state =
    loadSoftOneIngestionState();

  state.sources[
    entry.sourceKey
  ] = entry;

  state.updatedAt =
    new Date()
      .toISOString();

  writeFileSync(
    statePath(),
    JSON.stringify(
      state,
      null,
      2,
    ) + "\n",
    "utf8",
  );
}
