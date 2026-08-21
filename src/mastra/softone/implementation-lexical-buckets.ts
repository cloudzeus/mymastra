import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import type {
  SoftOneImplementationCorroborationMember,
  SoftOneImplementationCorroborationResult,
} from "./implementation-corroboration-types";


export interface SoftOneLexicalBucket {
  key: string;

  members:
    SoftOneImplementationCorroborationMember[];
}


interface BucketRule {
  key: string;

  any: string[];

  all?: string[];

  exclude?: string[];
}


const BUCKETS:
  BucketRule[] = [
    {
      key:
        "LOGIN_SINGLE_REQUEST",

      any: [
        "service login",
        "service: login",
        "service='login'",
        "service 'login'",
        "login service",
        "calling the login service",
        "performs softone authentication",
      ],

      exclude: [
        "two-step",
        "two step",
        "followed by authenticate",
        "→ authenticate",
      ],
    },

    {
      key:
        "LOGIN_TWO_STEP_AUTHENTICATE",

      any: [
        "two-step authentication",
        "two step authentication",
        "followed by authenticate",
        "login–authenticate",
        "login-authenticate",
        "→ authenticate",
      ],
    },

    {
      key:
        "CLIENTID_REQUEST_SESSION",

      all: [
        "clientid",
      ],

      any: [
        "subsequent",
        "session",
        "authenticated",
        "generic s1",
        "requests are built",
        "request bodies",
      ],

      exclude: [
        "sqlname",
        "sqldata",
        "selectorfields",
      ],
    },

    {
      key:
        "SESSION_EXPIRED_REAUTH",

      all: [
        "clientid",
      ],

      any: [
        "-100",
        "-101",
        "expired",
        "stale-session",
        "stale session",
        "re-auth",
        "reauth",
      ],
    },

    {
      key:
        "GETTABLE_REQUEST",

      any: [
        "gettable service",
        "'gettable'",
        "`gettable`",
        "service='gettable'",
        "service: gettable",
        "gettable request",
        "gettable client",
      ],
    },

    {
      key:
        "GETTABLE_RESPONSE",

      all: [
        "gettable",
      ],

      any: [
        "response",
        "success",
        "model",
        "data",
        "rows",
        "fields",
      ],
    },

    {
      key:
        "SQLDATA",

      any: [
        "sqldata",
        "sqlname",
      ],

      exclude: [
        "selectorfields",
      ],
    },

    {
      key:
        "GETOBJECTS",

      any: [
        "getobjects",
        "getsoftoneobjects",
      ],
    },

    {
      key:
        "GETOBJECTTABLES",

      any: [
        "getobjecttables",
        "getsoftoneobjecttables",
      ],
    },

    {
      key:
        "GETTABLEFIELDS",

      any: [
        "gettablefields",
        "getsoftonetablefields",
      ],
    },

    {
      key:
        "SELECTORFIELDS",

      any: [
        "selectorfields",
      ],
    },

    {
      key:
        "TRDR_IDENTITY",

      all: [
        "trdr",
      ],

      any: [
        "business key",
        "identifier",
        "externalid",
        "unique",
        "lookup key",
        "upsert",
        "main table",
        "customer",
        "supplier",
        "trader",
      ],
    },

    {
      key:
        "TRDR_SODTYPE",

      all: [
        "trdr",
        "sodtype",
      ],

      any: [
        "customer",
        "supplier",
        "12",
        "13",
      ],
    },

    {
      key:
        "ITEM_MTRL_MAPPING",

      any: [
        "object 'item'",
        "object `item`",
      ],

      all: [
        "mtrl",
      ],
    },

    {
      key:
        "BROWSER_PAGINATION",

      any: [
        "getbrowserinfo",
        "getbrowserdata",
      ],
    },
  ];


function normalize(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /[\n\r\t]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


function loadMultipass(
  capabilityKey: string,
): SoftOneImplementationCorroborationResult {
  const path =
    resolve(
      process.cwd(),
      "data",
      "softone-corroboration",
      `${capabilityKey.toLowerCase()}.multipass.json`,
    );


  return JSON.parse(
    readFileSync(
      path,
      "utf8",
    ),
  );
}


function loadReviewQueue(): any[] {
  const path =
    resolve(
      process.cwd(),
      process.env
        .SOFTONE_REVIEW_QUEUE_PATH ??
        "data/softone-review-queue.json",
    );


  const queue =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    );


  return queue.items ?? [];
}


function memberFromReviewItem(
  item: any,
): SoftOneImplementationCorroborationMember | null {
  if (
    !item?.evidence?.id ||
    !item?.evidence?.claim
  ) {
    return null;
  }


  const source =
    item.evidence.sources?.[0];


  const notes:
    string[] =
    Array.isArray(
      source?.notes,
    )
      ? source.notes
      : [];


  const candidateId =
    notes
      .find(
        note =>
          note.startsWith(
            "Implementation candidate:",
          ),
      )
      ?.replace(
        "Implementation candidate:",
        "",
      )
      .trim();


  const commit =
    notes
      .find(
        note =>
          note.startsWith(
            "Commit:",
          ),
      )
      ?.replace(
        "Commit:",
        "",
      )
      .trim();


  const sourceFiles =
    (
      item.evidence.sources ??
      []
    )
      .map(
        (ref: any) =>
          typeof ref.section ===
            "string"
            ? ref.section
            : "",
      )
      .filter(
        Boolean,
      );


  return {
    evidenceId:
      String(
        item.evidence.id,
      ),

    reviewId:
      typeof item.id ===
        "string"
        ? item.id
        : undefined,

    reviewStatus:
      item.status,

    repository:
      String(
        source?.sourceTitle ??
        "UNKNOWN",
      ),

    candidateId,

    claim:
      String(
        item.evidence.claim,
      ),

    kind:
      String(
        item.evidence.kind ??
        "UNKNOWN",
      ),

    sourceFiles,

    commit,
  };
}


function matchesRule(
  text: string,
  rule: BucketRule,
): boolean {
  if (
    rule.exclude?.some(
      term =>
        text.includes(
          term,
        ),
    )
  ) {
    return false;
  }


  if (
    rule.all &&
    !rule.all.every(
      term =>
        text.includes(
          term,
        ),
    )
  ) {
    return false;
  }


  return rule.any.some(
    term =>
      text.includes(
        term,
      ),
  );
}


export function buildSoftOneLexicalBuckets(
  capabilityKey: string,
): SoftOneLexicalBucket[] {
  const multipass =
    loadMultipass(
      capabilityKey,
    );


  const ungrouped =
    new Set(
      multipass.ungroupedEvidenceIds,
    );


  const queue =
    loadReviewQueue();


  const members =
    queue
      .filter(
        item =>
          item.classification ===
            capabilityKey &&
          item.status !==
            "REJECTED" &&
          ungrouped.has(
            item.evidence?.id,
          ),
      )
      .map(
        memberFromReviewItem,
      )
      .filter(
        (
          member,
        ): member is SoftOneImplementationCorroborationMember =>
          Boolean(
            member,
          ),
      );


  return BUCKETS
    .map(
      rule => ({
        key:
          rule.key,

        members:
          members.filter(
            member => {
              const text =
                normalize(
                  [
                    member.claim,
                    member.kind,
                    ...member.sourceFiles,
                  ].join(
                    " ",
                  ),
                );


              return matchesRule(
                text,
                rule,
              );
            },
          ),
      }),
    )
    /*
     * A corroboration bucket is useful only if
     * evidence comes from >= 2 independent repos.
     */
    .filter(
      bucket =>
        new Set(
          bucket.members.map(
            member =>
              member.repository,
          ),
        ).size >= 2,
    );
}
