import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  createHash,
} from "node:crypto";

import type {
  SoftOneEvidenceRecord,
} from "./evidence-types";

import type {
  SoftOneIngestionCandidate,
} from "./ingestion-types";

export type SoftOneReviewQueueStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "RESOLVED";

export interface SoftOneReviewQueueItem {
  id:
    string;

  sourceKey:
    string;

  sourceFingerprint:
    string;

  subject?:
    string;

  candidateId?:
    string;

  classification?:
    string;

  status:
    SoftOneReviewQueueStatus;

  reason:
    string;

  evidence?:
    SoftOneEvidenceRecord;

  rawReference?:
    Record<
      string,
      unknown
    >;

  notes:
    string[];

  createdAt:
    string;

  updatedAt:
    string;
}

export interface SoftOneReviewQueueFile {
  formatVersion:
    number;

  updatedAt:
    | string
    | null;

  items:
    SoftOneReviewQueueItem[];
}

const DEFAULT_PATH =
  resolve(
    process.cwd(),
    "data/softone-review-queue.json",
  );

function queuePath():
  string {
  return (
    process.env
      .SOFTONE_REVIEW_QUEUE_PATH ??
    DEFAULT_PATH
  );
}

function shortHash(
  value: string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
}

export function loadSoftOneReviewQueue():
  SoftOneReviewQueueFile {
  const path =
    queuePath();

  if (!existsSync(path)) {
    return {
      formatVersion: 1,
      updatedAt: null,
      items: [],
    };
  }

  return JSON.parse(
    readFileSync(
      path,
      "utf8",
    ),
  ) as SoftOneReviewQueueFile;
}

function saveSoftOneReviewQueue(
  queue:
    SoftOneReviewQueueFile,
): void {
  queue.updatedAt =
    new Date()
      .toISOString();

  writeFileSync(
    queuePath(),
    JSON.stringify(
      queue,
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

export function buildSoftOneReviewQueueId(
  input: {
    sourceKey:
      string;

    candidateId?:
      string;

    evidenceId?:
      string;

    reason:
      string;
  },
): string {
  return `REVIEW_${shortHash(
    [
      input.sourceKey,
      input.candidateId ?? "",
      input.evidenceId ?? "",
      input.reason,
    ].join("|"),
  )}`;
}

export function enqueueSoftOneReviewItem(
  item:
    Omit<
      SoftOneReviewQueueItem,
      | "id"
      | "createdAt"
      | "updatedAt"
    > & {
      id?:
        string;
    },
): SoftOneReviewQueueItem {
  const queue =
    loadSoftOneReviewQueue();

  const now =
    new Date()
      .toISOString();

  const id =
    item.id ??
    buildSoftOneReviewQueueId({
      sourceKey:
        item.sourceKey,

      candidateId:
        item.candidateId,

      evidenceId:
        item.evidence?.id,

      reason:
        item.reason,
    });

  const existingIndex =
    queue.items.findIndex(
      existing =>
        existing.id === id,
    );

  if (
    existingIndex >= 0
  ) {
    const existing =
      queue.items[
        existingIndex
      ];

    const updated:
      SoftOneReviewQueueItem = {
        ...existing,
        ...item,
        id,
        createdAt:
          existing.createdAt,
        updatedAt:
          now,
      };

    queue.items[
      existingIndex
    ] = updated;

    saveSoftOneReviewQueue(
      queue,
    );

    return updated;
  }

  const created:
    SoftOneReviewQueueItem = {
      ...item,
      id,
      createdAt:
        now,
      updatedAt:
        now,
    };

  queue.items.push(
    created,
  );

  saveSoftOneReviewQueue(
    queue,
  );

  return created;
}

export function enqueueSoftOneCandidateForReview(
  candidate:
    SoftOneIngestionCandidate,

  input?: {
    classification?:
      string;

    reason?:
      string;

    notes?:
      string[];
  },
): SoftOneReviewQueueItem {
  return enqueueSoftOneReviewItem({
    sourceKey:
      candidate.sourceKey,

    sourceFingerprint:
      candidate.sourceFingerprint,

    subject:
      String(
        candidate.rawReference
          ?.subject ??
        "",
      ) || undefined,

    candidateId:
      candidate.id,

    classification:
      input?.classification,

    status:
      "PENDING",

    reason:
      input?.reason ??
      "Candidate requires review before promotion or rejection.",

    evidence:
      candidate.evidence,

    rawReference:
      candidate.rawReference,

    notes: [
      ...(input?.notes ?? []),
      ...(candidate.extraction
        ?.reason ?? []),
    ],
  });
}

export function getSoftOneReviewQueueStats() {
  const queue =
    loadSoftOneReviewQueue();

  const byStatus:
    Record<string, number> =
      {};

  const byClassification:
    Record<string, number> =
      {};

  for (
    const item of
      queue.items
  ) {
    byStatus[
      item.status
    ] =
      (
        byStatus[
          item.status
        ] ?? 0
      ) + 1;

    const classification =
      item.classification ??
      "UNCLASSIFIED";

    byClassification[
      classification
    ] =
      (
        byClassification[
          classification
        ] ?? 0
      ) + 1;
  }

  return {
    total:
      queue.items.length,

    byStatus,

    byClassification,
  };
}

export function listSoftOneReviewQueue(
  status?:
    SoftOneReviewQueueStatus,
): SoftOneReviewQueueItem[] {
  const queue =
    loadSoftOneReviewQueue();

  if (!status) {
    return queue.items;
  }

  return queue.items.filter(
    item =>
      item.status ===
      status,
  );
}


export function setSoftOneReviewQueueStatus(
  id: string,
  status:
    SoftOneReviewQueueStatus,
  note?: string,
): SoftOneReviewQueueItem {
  const queue =
    loadSoftOneReviewQueue();


  const index =
    queue.items.findIndex(
      item =>
        item.id ===
        id,
    );


  if (
    index < 0
  ) {
    throw new Error(
      `SoftOne review queue item not found: ${id}`,
    );
  }


  const current =
    queue.items[
      index
    ];


  const now =
    new Date()
      .toISOString();


  const updated:
    SoftOneReviewQueueItem = {
    ...current,

    status,

    notes: [
      ...current.notes,
      ...(
        note
          ? [
              note,
            ]
          : []
      ),
    ],

    updatedAt:
      now,
  };


  queue.items[
    index
  ] =
    updated;


  saveSoftOneReviewQueue(
    queue,
  );


  return updated;
}
