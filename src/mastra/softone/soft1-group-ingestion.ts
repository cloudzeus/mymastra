import { createHash } from "node:crypto";

import type {
  SoftOneEvidenceRecord,
} from "./evidence-types";

export type SoftOneCommunityEvidenceLevel =
  | "MENTION"
  | "CONFIRMED"
  | "CORROBORATED";

export interface Soft1GroupMessage {
  author?: string;
  email?: string;
  date?: string;
  body: string;
}

export interface Soft1GroupThread {
  subject: string;
  threadUrl?: string;
  gmailUrl?: string;
  messages: Soft1GroupMessage[];
}

export interface Soft1GroupEvidenceCandidate {
  id: string;
  subject: string;
  claim: string;

  evidenceLevel:
    SoftOneCommunityEvidenceLevel;

  confidenceReasons: string[];

  participantCount: number;
  confirmationCount: number;

  authors: string[];

  firstPublishedAt?: string;
  lastPublishedAt?: string;

  sourceThreadUrl?: string;
  gmailUrl?: string;

  rawContext: string;

  evidenceRecord:
    SoftOneEvidenceRecord;
}

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeId(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      "_",
    )
    .replace(
      /^_+|_+$/g,
      "",
    );
}

function shortHash(
  value: string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}

function buildEvidenceId(
  subject: string,
  claim: string,
): string {
  const subjectPart =
    normalizeId(subject)
      .slice(0, 32);

  const claimPart =
    normalizeId(claim)
      .slice(0, 42);

  const hash =
    shortHash(
      `${subject}\n${claim}`,
    );

  return [
    "GROUP",
    subjectPart,
    claimPart,
    hash,
  ]
    .filter(Boolean)
    .join("_");
}

function unique<T>(
  values: T[],
): T[] {
  return [...new Set(values)];
}

export function buildSoft1ThreadSourceKey(
  thread: Soft1GroupThread,
): string {
  const dated =
    thread.messages
      .map((message, index) => ({
        message,
        index,
      }))
      .sort((a, b) =>
        (a.message.date ?? "").localeCompare(
          b.message.date ?? "",
        ),
      );

  const first =
    dated[0]?.message ??
    thread.messages[0];

  const canonical = [
    thread.threadUrl ?? "",
    thread.subject.trim().toLowerCase(),
    first?.date ?? "",
    first?.author ?? first?.email ?? "",
  ].join("|");

  const digest =
    createHash("sha256")
      .update(canonical)
      .digest("hex")
      .slice(0, 24);

  return `soft1-thread:${digest}`;
}

export function buildSoft1ThreadFingerprint(
  thread: Soft1GroupThread,
): string {
  const canonical = [
    thread.subject.trim().toLowerCase(),
    ...thread.messages.map(message =>
      [
        message.author ?? "",
        message.email ?? "",
        message.date ?? "",
        normalizeText(message.body),
      ].join("|"),
    ),
  ].join("\n---\n");

  return createHash("sha256")
    .update(canonical)
    .digest("hex");
}

function extractAuthors(
  thread: Soft1GroupThread,
): string[] {
  return unique(
    thread.messages
      .map(
        message =>
          message.author?.trim() ||
          message.email?.trim() ||
          "",
      )
      .filter(Boolean),
  );
}

function detectExplicitConfirmation(
  body: string,
): boolean {
  const normalized =
    body.toLowerCase();

  const patterns = [
    "δούλεψε",
    "δουλεψε",
    "λειτούργησε",
    "λειτουργησε",
    "το έλυσε",
    "το ελυσε",
    "το έλυσα",
    "το ελυσα",
    "έλυσα",
    "ελυσα",
    "λύθηκε",
    "λυθηκε",
    "worked",
    "works now",
    "solved",
    "fixed",
    "this worked",
    "it worked",
    "confirmed",
  ];

  return patterns.some(
    pattern =>
      normalized.includes(pattern),
  );
}

function countConfirmations(
  thread: Soft1GroupThread,
): number {
  return thread.messages.filter(
    message =>
      detectExplicitConfirmation(
        message.body,
      ),
  ).length;
}

export function inferSoft1GroupEvidenceLevel(
  thread: Soft1GroupThread,
): {
  level:
    SoftOneCommunityEvidenceLevel;
  reasons: string[];
} {
  const confirmations =
    countConfirmations(thread);

  const authors =
    extractAuthors(thread);

  /*
   * CORROBORATED is deliberately conservative.
   * A single Gmail thread cannot establish
   * independent cross-thread corroboration.
   */
  if (confirmations > 0) {
    return {
      level: "CONFIRMED",
      reasons: [
        `${confirmations} explicit success/confirmation message(s) detected`,
        `${authors.length} participant identity/identities detected`,
      ],
    };
  }

  return {
    level: "MENTION",
    reasons: [
      "No explicit requester success confirmation detected",
      `${authors.length} participant identity/identities detected`,
    ],
  };
}

function dateBounds(
  thread: Soft1GroupThread,
): {
  first?: string;
  last?: string;
} {
  const dates =
    thread.messages
      .map(message => message.date)
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      )
      .sort();

  return {
    first: dates[0],
    last:
      dates.length > 0
        ? dates[dates.length - 1]
        : undefined,
  };
}

/*
 * This function intentionally does NOT attempt
 * to infer a technical claim from arbitrary prose.
 *
 * claim must be supplied by an upstream extractor
 * or a human-reviewed ingestion step.
 */
export function buildSoft1GroupEvidenceCandidate(
  thread: Soft1GroupThread,
  claim: string,
  options?: {
    kind?:
      SoftOneEvidenceRecord["kind"];
    productAreas?:
      SoftOneEvidenceRecord[
        "productAreas"
      ];
    tags?: string[];
    softOneVersion?: string;
  },
): Soft1GroupEvidenceCandidate {
  const normalizedClaim =
    normalizeText(claim);

  if (!normalizedClaim) {
    throw new Error(
      "Claim is required.",
    );
  }

  if (
    !thread.subject.trim()
  ) {
    throw new Error(
      "Thread subject is required.",
    );
  }

  if (
    thread.messages.length === 0
  ) {
    throw new Error(
      "Thread must contain at least one message.",
    );
  }

  const {
    level,
    reasons,
  } = inferSoft1GroupEvidenceLevel(
    thread,
  );

  const authors =
    extractAuthors(thread);

  const confirmations =
    countConfirmations(thread);

  const dates =
    dateBounds(thread);

  const id =
    buildEvidenceId(
      thread.subject,
      normalizedClaim,
    );

  const rawContext =
    thread.messages
      .map((message, index) => {
        const author =
          message.author ??
          message.email ??
          "UNKNOWN";

        return [
          `MESSAGE ${index + 1}`,
          `AUTHOR: ${author}`,
          message.date
            ? `DATE: ${message.date}`
            : undefined,
          normalizeText(
            message.body,
          ),
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join(
        "\n\n---\n\n",
      );

  const evidenceRecord:
    SoftOneEvidenceRecord = {
      id,

      claim:
        normalizedClaim,

      kind:
        options?.kind ??
        "SCRIPT_PATTERN",

      /*
       * Community evidence alone never enters
       * the registry as VERIFIED.
       */
      status:
        "DERIVED",

      scope:
        "GLOBAL",

      softOneVersion:
        options?.softOneVersion,

      productAreas:
        options?.productAreas ?? [
          "CUSTOMIZATION",
          "SCRIPTING",
        ],

      sources: [
        {
          sourceId:
            "SOFT1_DEVELOPERS_GROUP",

          sourceTitle:
            thread.subject,

          sourceUrl:
            thread.threadUrl,

          publishedAt:
            dates.first,

          notes: [
            `Community evidence level: ${level}`,
            `Participants: ${authors.length}`,
            `Explicit confirmations: ${confirmations}`,
            ...(thread.gmailUrl
              ? [
                  `Authenticated mailbox source available`,
                ]
              : []),
          ],
        },
      ],

      verificationNotes: [
        ...reasons,
        "Community-derived candidate. Requires official documentation, tenant verification, user-verified implementation or independent corroboration before promotion to VERIFIED.",
      ],

      limitations: [
        "Google Group discussion may be SoftOne-version specific.",
        "A working solution in one installation does not prove universal tenant behavior.",
      ],

      tags: [
        "soft1-developers-group",
        "community",
        level.toLowerCase(),
        ...(options?.tags ?? []),
      ],
    };

  return {
    id,
    subject:
      thread.subject,
    claim:
      normalizedClaim,

    evidenceLevel:
      level,

    confidenceReasons:
      reasons,

    participantCount:
      authors.length,

    confirmationCount:
      confirmations,

    authors,

    firstPublishedAt:
      dates.first,

    lastPublishedAt:
      dates.last,

    sourceThreadUrl:
      thread.threadUrl,

    gmailUrl:
      thread.gmailUrl,

    rawContext,

    evidenceRecord,
  };
}
