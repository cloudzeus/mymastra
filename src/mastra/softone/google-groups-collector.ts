import {
  createHash,
} from "node:crypto";

import type {
  Soft1ForumCorpusFile,
  Soft1ForumMessage,
  Soft1ForumThread,
} from "./soft1-forum-corpus-types";


export const SOFT1_DEVELOPERS_GROUP_URL =
  "https://groups.google.com/g/soft1" as const;


export interface Soft1CollectedMessageInput {
  messageId?: string;

  author?: string;

  email?: string;

  publishedAt?: string;

  body: string;

  parentMessageId?: string;

  sourceUrl?: string;
}


export interface Soft1CollectedThreadInput {
  /*
   * Prefer Gmail thread ID whenever available,
   * because the existing corpus already uses it
   * as canonical source identity.
   */
  gmailThreadId?: string;

  groupThreadId?: string;

  subject: string;

  threadUrl?: string;

  gmailUrl?: string;

  messages:
    Soft1CollectedMessageInput[];

  complete:
    boolean;
}


function hash(
  value: string,
): string {
  return createHash(
    "sha256",
  )
    .update(value)
    .digest("hex");
}


function normalizeBody(
  value: string,
): string {
  return value
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


function buildMessageId(
  input:
    Soft1CollectedMessageInput,

  index:
    number,
): string {
  if (
    input.messageId
      ?.trim()
  ) {
    return input
      .messageId
      .trim();
  }

  const canonical = [
    input.author ?? "",
    input.email ?? "",
    input.publishedAt ?? "",
    normalizeBody(
      input.body,
    ),
    String(index),
  ].join("|");

  return `derived-message:${hash(
    canonical,
  ).slice(0, 24)}`;
}


function buildSourceKey(
  input:
    Soft1CollectedThreadInput,
): string {
  if (
    input.gmailThreadId
      ?.trim()
  ) {
    return `gmail-thread:${input.gmailThreadId.trim()}`;
  }

  if (
    input.groupThreadId
      ?.trim()
  ) {
    return `google-group-thread:${input.groupThreadId.trim()}`;
  }

  const canonical = [
    input.threadUrl ?? "",
    input.subject.trim().toLowerCase(),
    input.messages[0]
      ?.publishedAt ??
      "",
    input.messages[0]
      ?.author ??
      input.messages[0]
        ?.email ??
      "",
  ].join("|");

  return `soft1-thread:${hash(
    canonical,
  ).slice(0, 24)}`;
}


function normalizeMessage(
  input:
    Soft1CollectedMessageInput,

  index:
    number,
): Soft1ForumMessage {
  return {
    messageId:
      buildMessageId(
        input,
        index,
      ),

    author:
      input.author
        ?.trim() ||
      undefined,

    email:
      input.email
        ?.trim() ||
      undefined,

    publishedAt:
      input.publishedAt
        ?.trim() ||
      undefined,

    body:
      normalizeBody(
        input.body,
      ),

    parentMessageId:
      input.parentMessageId
        ?.trim() ||
      undefined,

    sourceUrl:
      input.sourceUrl
        ?.trim() ||
      undefined,
  };
}


export function normalizeCollectedSoft1Thread(
  input:
    Soft1CollectedThreadInput,
): Soft1ForumThread {
  if (
    !input.subject
      .trim()
  ) {
    throw new Error(
      "Soft1 forum thread subject is required.",
    );
  }

  if (
    input.messages.length ===
    0
  ) {
    throw new Error(
      "Soft1 forum thread requires at least one message.",
    );
  }

  const messages =
    input.messages.map(
      normalizeMessage,
    );

  const dates =
    messages
      .map(
        message =>
          message.publishedAt,
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      )
      .sort();

  return {
    sourceKey:
      buildSourceKey(
        input,
      ),

    gmailThreadId:
      input.gmailThreadId,

    groupThreadId:
      input.groupThreadId,

    subject:
      input.subject.trim(),

    threadUrl:
      input.threadUrl,

    gmailUrl:
      input.gmailUrl,

    messages,

    completeness:
      input.complete
        ? "COMPLETE"
        : "PARTIAL",

    firstPublishedAt:
      dates[0],

    lastPublishedAt:
      dates.length > 0
        ? dates[
            dates.length -
            1
          ]
        : undefined,

    lastCollectedAt:
      new Date()
        .toISOString(),
  };
}


export function buildSoft1ForumCorpus(
  inputs:
    Soft1CollectedThreadInput[],
): Soft1ForumCorpusFile {
  return {
    formatVersion: 2,

    source:
      "SOFT1_DEVELOPERS_GROUP",

    sourceUrl:
      SOFT1_DEVELOPERS_GROUP_URL,

    collectedAt:
      new Date()
        .toISOString(),

    threads:
      inputs.map(
        normalizeCollectedSoft1Thread,
      ),
  };
}
