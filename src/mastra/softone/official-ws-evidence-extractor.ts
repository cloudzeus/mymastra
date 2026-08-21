import {
  createHash,
} from "node:crypto";

import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import type {
  SoftOneClaimKind,
  SoftOneEvidenceRecord,
} from "./evidence-types";

import type {
  SoftOneIngestionCandidate,
} from "./ingestion-types";

import type {
  SoftOneProductArea,
} from "./source-types";

import type {
  SoftOneOfficialWsSnapshot,
  SoftOneOfficialWsSection,
} from "./official-ws-reference";


const SOURCE_ID =
  "OFFICIAL_SOFTONE_WS_DOCS";


function sha256(
  value: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "hex",
    );
}


function shortHash(
  value: string,
): string {
  return sha256(
    value,
  )
    .slice(
      0,
      24,
    )
    .toUpperCase();
}


function snapshotPath():
  string {
  return resolve(
    process.cwd(),
    "data",
    "softone-official",
    "web-services-reference.json",
  );
}


export function loadSoftOneOfficialWsSnapshot():
  SoftOneOfficialWsSnapshot {
  return JSON.parse(
    readFileSync(
      snapshotPath(),
      "utf8",
    ),
  ) as SoftOneOfficialWsSnapshot;
}


function findSection(
  snapshot:
    SoftOneOfficialWsSnapshot,
  title: string,
): SoftOneOfficialWsSection {
  const section =
    snapshot.sections.find(
      item =>
        item.title
          .toLowerCase() ===
        title.toLowerCase(),
    );


  if (!section) {
    throw new Error(
      `Official WS section not found: ${title}`,
    );
  }


  return section;
}


interface AtomicDefinition {
  key: string;

  section: string;

  claim: string;

  kind: SoftOneClaimKind;

  productAreas:
    SoftOneProductArea[];

  tags: string[];

  conditions?: string[];

  limitations?: string[];
}


function methodInventoryDefinitions(
  snapshot:
    SoftOneOfficialWsSnapshot,
): AtomicDefinition[] {
  return snapshot.discoveredMethods.map(
    method => ({
      key:
        `METHOD_${method.toUpperCase()}`,

      section:
        method,

      claim:
        `The official SoftOne Web Services reference documents the '${method}' Web Service method.`,

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
      ],

      tags: [
        "official",
        "web-services",
        "method-inventory",
        method,
      ],

      limitations: [
        "This claim verifies that the method is documented; request and response semantics are represented by separate atomic evidence records where available.",
      ],
    }),
  );
}


const ATOMIC_DEFINITIONS:
  AtomicDefinition[] = [
    /*
     * Authentication
     */
    {
      key:
        "LOGIN_RETURNS_TEMPORARY_CLIENTID",

      section:
        "login",

      claim:
        "The SoftOne 'login' Web Service returns a temporary clientID that can be used with the 'authenticate' Web Service.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "INTEGRATIONS",
      ],

      tags: [
        "authentication",
        "login",
        "clientID",
      ],
    },

    {
      key:
        "LOGIN_DIRECT_AUTHENTICATION_MODE",

      section:
        "login",

      claim:
        "SoftOne Web Services support direct authentication through the 'login' service when COMPANY, BRANCH, MODULE and REFID are already known, without a separate 'authenticate' call.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "INTEGRATIONS",
      ],

      tags: [
        "authentication",
        "login",
        "direct-login",
      ],
    },

    {
      key:
        "DIRECT_LOGIN_RETURNS_SESSION_CLIENTID",

      section:
        "login",

      claim:
        "A successful direct SoftOne 'login' request returns a unique clientID that must be included in subsequent Web Service requests.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "INTEGRATIONS",
      ],

      tags: [
        "authentication",
        "clientID",
        "session",
      ],
    },

    {
      key:
        "AUTHENTICATE_TWO_STEP_MODE",

      section:
        "authenticate",

      claim:
        "SoftOne Web Services support a two-step authentication flow in which 'login' supplies a temporary clientID and 'authenticate' uses that clientID together with COMPANY, BRANCH, MODULE and REFID.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "INTEGRATIONS",
      ],

      tags: [
        "authentication",
        "authenticate",
        "two-step",
      ],
    },

    {
      key:
        "AUTHENTICATE_RETURNS_SESSION_CLIENTID",

      section:
        "authenticate",

      claim:
        "A successful SoftOne 'authenticate' request returns a unique clientID that must be included in all subsequent Web Service requests.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "INTEGRATIONS",
      ],

      tags: [
        "authentication",
        "clientID",
        "session",
      ],
    },

    {
      key:
        "CLIENTID_VALIDITY_ACCOUNT_SETTING",

      section:
        "authenticate",

      claim:
        "The authenticated SoftOne clientID remains valid for the duration defined in the user's Web Account settings.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
      ],

      tags: [
        "clientID",
        "session",
        "expiration",
      ],
    },

    /*
     * Object metadata
     */
    {
      key:
        "GETOBJECTS_RETURNS_BUSINESS_OBJECTS",

      section:
        "getObjects",

      claim:
        "The SoftOne 'getObjects' Web Service returns the application Business Objects.",

      kind:
        "OBJECT_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "OBJECT_MODEL",
      ],

      tags: [
        "metadata",
        "objects",
        "getObjects",
      ],
    },

    {
      key:
        "GETOBJECTTABLES_RETURNS_OBJECT_TABLES",

      section:
        "getObjectTables",

      claim:
        "The SoftOne 'getObjectTables' Web Service returns the tables of a specified Business Object.",

      kind:
        "OBJECT_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "OBJECT_MODEL",
        "SCHEMA",
      ],

      tags: [
        "metadata",
        "tables",
        "getObjectTables",
      ],
    },

    {
      key:
        "CUSTOMER_TABLE_TRDR_MAPPING",

      section:
        "getObjectTables",

      claim:
        "In the official SoftOne getObjectTables example, Business Object CUSTOMER contains table CUSTOMER whose physical database table name is TRDR.",

      kind:
        "PHYSICAL_MAPPING",

      productAreas: [
        "WEB_SERVICES",
        "OBJECT_MODEL",
        "SCHEMA",
        "PHYSICAL_DATABASE",
      ],

      tags: [
        "CUSTOMER",
        "TRDR",
        "physical-mapping",
      ],

      limitations: [
        "This evidence is taken from the official CUSTOMER example shown in the Web Services reference.",
      ],
    },

    {
      key:
        "GETTABLEFIELDS_RETURNS_FIELD_METADATA",

      section:
        "getTableFields",

      claim:
        "The SoftOne 'getTableFields' Web Service returns field metadata for a specified table of a specified Business Object.",

      kind:
        "FIELD_SEMANTICS",

      productAreas: [
        "WEB_SERVICES",
        "OBJECT_MODEL",
        "SCHEMA",
      ],

      tags: [
        "metadata",
        "fields",
        "getTableFields",
      ],
    },

    {
      key:
        "CUSTOMER_FIELD_SODTYPE",

      section:
        "getTableFields",

      claim:
        "The official SoftOne CUSTOMER table field example includes CUSTOMER.SODTYPE with field name SODTYPE.",

      kind:
        "FIELD_SEMANTICS",

      productAreas: [
        "WEB_SERVICES",
        "OBJECT_MODEL",
        "SCHEMA",
      ],

      tags: [
        "CUSTOMER",
        "SODTYPE",
      ],

      limitations: [
        "This verifies field presence in the documented CUSTOMER example; it does not by itself define every possible SODTYPE semantic value.",
      ],
    },

    {
      key:
        "CUSTOMER_FIELD_TRDR",

      section:
        "getTableFields",

      claim:
        "The official SoftOne CUSTOMER table field example includes CUSTOMER.TRDR with field name TRDR.",

      kind:
        "FIELD_SEMANTICS",

      productAreas: [
        "WEB_SERVICES",
        "OBJECT_MODEL",
        "SCHEMA",
      ],

      tags: [
        "CUSTOMER",
        "TRDR",
      ],
    },

    {
      key:
        "CUSTOMER_FIELD_CODE",

      section:
        "getTableFields",

      claim:
        "The official SoftOne CUSTOMER table field example includes CUSTOMER.CODE with field name CODE.",

      kind:
        "FIELD_SEMANTICS",

      productAreas: [
        "WEB_SERVICES",
        "OBJECT_MODEL",
        "SCHEMA",
      ],

      tags: [
        "CUSTOMER",
        "CODE",
      ],
    },

    /*
     * selectorFields
     */
    {
      key:
        "SELECTORFIELDS_REQUEST_CONTRACT",

      section:
        "selectorFields",

      claim:
        "The documented SoftOne 'selectorFields' request uses clientID, appId, TABLENAME, KEYNAME, KEYVALUE and RESULTFIELDS.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "INTEGRATIONS",
      ],

      tags: [
        "selectorFields",
        "request-contract",
      ],
    },

    {
      key:
        "SELECTORFIELDS_RESPONSE_CONTRACT",

      section:
        "selectorFields",

      claim:
        "The documented SoftOne 'selectorFields' response includes success, totalcount and rows.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "INTEGRATIONS",
      ],

      tags: [
        "selectorFields",
        "response-contract",
      ],
    },

    /*
     * SqlData
     */
    {
      key:
        "SQLDATA_EXECUTES_NAMED_SQL_SCRIPT",

      section:
        "SqlData",

      claim:
        "The SoftOne 'SqlData' Web Service executes the SQL Script identified by SqlName and returns result data.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "SQLDATA",
        "SQL",
      ],

      tags: [
        "SqlData",
        "SqlName",
        "sql-script",
      ],
    },

    {
      key:
        "SQLDATA_REQUEST_CONTRACT",

      section:
        "SqlData",

      claim:
        "The documented SoftOne 'SqlData' request includes service='SqlData', clientID, appId, SqlName and param1.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "SQLDATA",
        "SQL",
      ],

      tags: [
        "SqlData",
        "request-contract",
        "param1",
      ],
    },

    {
      key:
        "SQLDATA_PARAM1_PLACEHOLDER",

      section:
        "SqlData",

      claim:
        "SoftOne SqlData SQL Script parameters can reference the request parameter param1 using the placeholder '{param1}'.",

      kind:
        "SQL_PATTERN",

      productAreas: [
        "WEB_SERVICES",
        "SQLDATA",
        "SQL",
      ],

      tags: [
        "SqlData",
        "param1",
        "placeholder",
      ],
    },

    {
      key:
        "SQLDATA_RESPONSE_CONTRACT",

      section:
        "SqlData",

      claim:
        "The documented SoftOne 'SqlData' response includes success, totalcount and rows.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
        "SQLDATA",
      ],

      tags: [
        "SqlData",
        "response-contract",
      ],
    },

    /*
     * Error codes
     */
    {
      key:
        "ERROR_MINUS_101_SESSION_EXPIRED",

      section:
        "Error codes",

      claim:
        "SoftOne Web Services error code -101 means 'Invalid Request, session has expired' and is associated with Web Account time expiration.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
      ],

      tags: [
        "error-code",
        "-101",
        "session-expired",
      ],
    },

    {
      key:
        "ERROR_MINUS_100_SESSION_EXPIRED",

      section:
        "Error codes",

      claim:
        "SoftOne Web Services error code -100 means 'Invalid Request, session has expired'.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
      ],

      tags: [
        "error-code",
        "-100",
        "session-expired",
      ],
    },

    {
      key:
        "ERROR_MINUS_7_SESSION_EXPIRED",

      section:
        "Error codes",

      claim:
        "SoftOne Web Services error code -7 means 'Session has expired' and is associated with Web Account FinalDate expiration.",

      kind:
        "API_BEHAVIOR",

      productAreas: [
        "WEB_SERVICES",
      ],

      tags: [
        "error-code",
        "-7",
        "session-expired",
      ],
    },
  ];


function buildCandidate(
  snapshot:
    SoftOneOfficialWsSnapshot,
  definition:
    AtomicDefinition,
): SoftOneIngestionCandidate {
  const section =
    findSection(
      snapshot,
      definition.section,
    );


  const id =
    `OFFICIAL_WS_${shortHash(
      [
        snapshot.sha256,
        definition.key,
        definition.claim,
      ].join(
        "|",
      ),
    )}`;


  const sourceKey =
    [
      SOURCE_ID,
      definition.section,
      definition.key,
    ].join(
      ":",
    );


  const evidence:
    SoftOneEvidenceRecord = {
    id,

    claim:
      definition.claim,

    kind:
      definition.kind,

    status:
      "VERIFIED",

    scope:
      "GLOBAL",

    productAreas:
      definition.productAreas,

    sources: [
      {
        sourceId:
          SOURCE_ID,

        sourceUrl:
          snapshot.source.url,

        sourceTitle:
          snapshot.source.title,

        section:
          definition.section,

        retrievedAt:
          snapshot.retrievedAt,

        notes: [
          `Official WS snapshot SHA256: ${snapshot.sha256}`,
          `Official WS section: ${definition.section}`,
          `Official WS section kind: ${section.kind}`,
          "Extraction: deterministic",
        ],
      },
    ],

    conditions:
      definition.conditions,

    limitations:
      definition.limitations,

    verificationNotes: [
      "Claim extracted deterministically from the official SoftOne Web Services reference.",
      "No implementation repository was used to establish VERIFIED status.",
    ],

    tags:
      definition.tags,

    createdAt:
      snapshot.retrievedAt,

    updatedAt:
      snapshot.retrievedAt,
  };


  return {
    id:
      `CANDIDATE_${id}`,

    source:
      "WEB_DOCUMENTATION",

    sourceKey,

    sourceFingerprint:
      sha256(
        [
          snapshot.sha256,
          definition.section,
          section.text,
        ].join(
          "|",
        ),
      ),

    status:
      "ACCEPTED",

    evidence,

    rawReference: {
      subject:
        snapshot.source.title,

      section:
        definition.section,
    },

    extraction: {
      automatic:
        true,

      confidence:
        "HIGH",

      reason: [
        "Official documentation source.",
        "Exact documentation section is preserved.",
        "Source snapshot SHA256 is preserved.",
        "Claim is deterministic and atomic.",
      ],

      requiresHumanReview:
        false,
    },

    createdAt:
      snapshot.retrievedAt,
  };
}


export function extractSoftOneOfficialWsEvidence():
  SoftOneIngestionCandidate[] {
  const snapshot =
    loadSoftOneOfficialWsSnapshot();


  if (
    snapshot.missingExpectedMethods.length >
      0 ||
    !snapshot.hasErrorCodes
  ) {
    throw new Error(
      "Official SoftOne Web Services snapshot is incomplete.",
    );
  }


  const definitions = [
    ...methodInventoryDefinitions(
      snapshot,
    ),

    ...ATOMIC_DEFINITIONS,
  ];


  return definitions.map(
    definition =>
      buildCandidate(
        snapshot,
        definition,
      ),
  );
}
