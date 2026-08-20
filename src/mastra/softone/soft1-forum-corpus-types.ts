export type Soft1ForumThreadCompleteness =
  | "COMPLETE"
  | "PARTIAL";

export interface Soft1ForumMessage {
  messageId: string;

  author?: string;

  email?: string;

  publishedAt?: string;

  body: string;

  parentMessageId?: string;

  sourceUrl?: string;
}

export interface Soft1ForumNormalizedProjection {
  classification:
    | "CONFIRMED"
    | "MENTION"
    | "FAILED"
    | "PROSE_REVIEW"
    | "BUSINESS_IDEA";

  rawTechnicalContent: string;

  notes: string[];
}

export interface Soft1ForumThread {
  /*
   * Canonical identity.
   *
   * Existing Gmail-imported threads MUST retain:
   * gmail-thread:<gmailThreadId>
   */
  sourceKey: string;

  gmailThreadId?: string;

  groupThreadId?: string;

  subject: string;

  threadUrl?: string;

  gmailUrl?: string;

  messages:
    Soft1ForumMessage[];

  completeness:
    Soft1ForumThreadCompleteness;

  firstPublishedAt?: string;

  lastPublishedAt?: string;

  lastCollectedAt: string;

  normalized?:
    Soft1ForumNormalizedProjection;
}

export interface Soft1ForumCorpusFile {
  formatVersion: 2;

  source:
    "SOFT1_DEVELOPERS_GROUP";

  sourceUrl:
    "https://groups.google.com/g/soft1";

  collectedAt: string;

  threads:
    Soft1ForumThread[];
}
