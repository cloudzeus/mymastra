import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import iconv from "iconv-lite";
import { gunzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";

import {
  getSoftOneConnection,
  type SoftOneConnection,
} from "../softone/connection-provider";

/*
 * SoftOne authenticated sessions are installation/connection specific.
 *
 * Never share one global clientID across tenants.
 */
const clientIdsByConnection =
  new Map<string, string>();

type SoftOneResponse = {
  success?: boolean;
  error?: string;
  errorcode?: number | string;
  clientID?: string;
  [key: string]: unknown;
};

async function raw<T = SoftOneResponse>(
  connection: SoftOneConnection,
  payload: Record<string, unknown>,
): Promise<T> {
  const timeoutMs =
    Math.max(
      5_000,
      Number(
        process.env.SOFTONE_WS_TIMEOUT_MS ??
        20_000,
      ),
    );


  const res = await fetch(connection.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
    },
    body: JSON.stringify(payload),
    cache: "no-store",

    signal:
      AbortSignal.timeout(
        timeoutMs,
      ),
  });

  const received = Buffer.from(await res.arrayBuffer());

  /*
   * Node fetch may already have decompressed a gzip response depending on
   * runtime/transport behavior.
   *
   * Therefore we only gunzip when the received bytes still contain the
   * gzip magic header 1F 8B.
   */
  const isGzip =
    received.length >= 2 &&
    received[0] === 0x1f &&
    received[1] === 0x8b;

  const decodedBuffer = isGzip ? gunzipSync(received) : received;

  const text = iconv.decode(decodedBuffer, "win1253");

  if (!res.ok) {
    throw new Error(
      `SoftOne HTTP error ${res.status}: ${text.slice(0, 500)}`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `SoftOne returned invalid JSON after win1253 decoding: ${text.slice(
        0,
        500,
      )}`,
    );
  }
}

async function authenticate(
  connectionId: string,
  connection: SoftOneConnection,
): Promise<string> {
  const login = await raw<SoftOneResponse>(
    connection,
    {
      service: "login",
      username: connection.username,
      password: connection.password,
      appId: connection.appId,
    },
  );

  if (!login.success || !login.clientID) {
    throw new Error(
      `SoftOne login failed for connection ${connectionId}: ${String(
        login.error ?? "unknown error",
      )}`,
    );
  }

  const auth = await raw<SoftOneResponse>(
    connection,
    {
      service: "authenticate",
      clientID: login.clientID,
      company: connection.company,
      branch: connection.branch,
      module: connection.module ?? "0",
      refid: connection.refid,
      appId: connection.appId,
    },
  );

  if (!auth.success || !auth.clientID) {
    throw new Error(
      `SoftOne authenticate failed for connection ${connectionId}: ${String(
        auth.error ?? "unknown error",
      )}`,
    );
  }

  clientIdsByConnection.set(
    connectionId,
    auth.clientID,
  );

  return auth.clientID;
}

export async function callSoftOneAuthenticated<T = SoftOneResponse>(
  connectionId: string,
  payload: Record<string, unknown>,
): Promise<T> {
  /*
   * Credentials are loaded server-side and are never part
   * of the Mastra tool input or returned to the agent.
   */
  const connection =
    await getSoftOneConnection(
      connectionId,
    );

  const cachedClientID =
    clientIdsByConnection.get(
      connectionId,
    );

  const clientID =
    cachedClientID ??
    await authenticate(
      connectionId,
      connection,
    );

  let result =
    await raw<SoftOneResponse>(
      connection,
      {
        ...payload,
        clientID,
        appId:
          connection.appId,
      },
    );

  /*
   * Negative SoftOne error codes may indicate an invalid/
   * expired authenticated session.
   *
   * Clear only this connection's session and authenticate
   * again. Never affect another tenant.
   */
  if (
    result.success === false &&
    Number(
      result.errorcode ?? 0,
    ) < 0
  ) {
    clientIdsByConnection.delete(
      connectionId,
    );

    const freshClientId =
      await authenticate(
        connectionId,
        connection,
      );

    result =
      await raw<SoftOneResponse>(
        connection,
        {
          ...payload,
          clientID:
            freshClientId,
          appId:
            connection.appId,
        },
      );
  }

  return result as T;
}

const payloadSchema = z.record(z.string(), z.unknown());

export const softoneCall = createTool({
  id: "softone-call",

  description:
    "Calls SoftOne Web Services. Intended for read-only analysis and discovery. " +
    "Handles login/authenticate and windows-1253 response decoding. " +
    "Production setData/delData are blocked for the Analyst.",

  inputSchema: z.object({
    connectionId: z
      .string()
      .min(1)
      .describe(
        "Server-side SoftOne connection identifier. Credentials are never supplied to the agent.",
      ),

    service: z.string().describe(
      "SoftOne service, for example getData, getBrowserInfo, getBrowserData, getObjectTables, getTableFields, calculate",
    ),

    payload: payloadSchema.describe(
      "Remaining SoftOne request fields such as object, key, list, filters or data",
    ),
  }),

  execute: async ({
    connectionId,
    service,
    payload,
  }) => {
    const normalizedService =
      service.trim().toLowerCase();

    if (
      ["setdata", "deldata"].includes(
        normalizedService,
      )
    ) {
      return {
        blocked: true,
        writePerformed: false,
        requiresHumanApproval: true,
        reason:
          "Business Analyst is not allowed to execute production SoftOne writes. Prepare the payload and request approval.",
      };
    }

    /*
     * service is written AFTER payload so callers cannot
     * override the approved service by including another
     * service property inside payload.
     */
    return callSoftOneAuthenticated(
      connectionId,
      {
        ...payload,
        service,
      },
    );
  },
});

type Field = {
  name: string;
  caption?: string;
  type?: string;
  required?: boolean;
  editor?: string | null;
};

type SchemaTable = {
  name: string;
  fields: Field[];
};

type SchemaObj = {
  caption?: string;
  type?: string;
  tables: SchemaTable[];
};

let schemaCache: Record<string, SchemaObj> | null = null;

function getSchemaPath(): string {
  return (
    process.env.SOFTONE_SCHEMA_PATH ??
    "data/softone-full-schema.json.gz"
  );
}

function loadSchema(): Record<string, SchemaObj> {
  if (schemaCache) {
    return schemaCache;
  }

  const path = getSchemaPath();

  if (!existsSync(path)) {
    throw new Error(
      `SoftOne schema cache not found at ${path}. Configure SOFTONE_SCHEMA_PATH or add the schema file.`,
    );
  }

  const compressed = readFileSync(path);

  schemaCache = JSON.parse(
    gunzipSync(compressed).toString("utf8"),
  ) as Record<string, SchemaObj>;

  return schemaCache;
}

export const softoneSchemaLookup = createTool({
  id: "softone-schema-lookup",

  description:
    "Returns SoftOne object tables and fields from the cached schema. " +
    "Use this before making assumptions about SoftOne object/table/field names.",

  inputSchema: z.object({
    object: z.string().describe(
      "SoftOne object, for example CUSTOMER, ITEM, SALDOC",
    ),

    table: z.string().optional().describe(
      "Optional table name",
    ),

    onlyRequired: z.boolean().default(false),
  }),

  execute: async ({
    object,
    table,
    onlyRequired,
  }) => {
    try {
      const schema = loadSchema();

      const objectName = object.toUpperCase();

      const obj = schema[objectName];

      if (!obj) {
        return {
          found: false,
          object: objectName,
          hint:
            "Object is not present in cached schema. Consider verified live getObjectTables/getTableFields.",
        };
      }

      const tables = table
        ? obj.tables.filter(
            (candidate) =>
              candidate.name.toUpperCase() === table.toUpperCase(),
          )
        : obj.tables;

      return {
        found: true,
        object: objectName,
        caption: obj.caption,
        type: obj.type,
        mainTable: obj.tables[0]?.name,

        tables: tables.map((candidate) => ({
          name: candidate.name,

          fields: candidate.fields
            .filter((field) =>
              onlyRequired ? field.required === true : true,
            )
            .map((field) => ({
              name: field.name,
              caption: field.caption,
              type: field.type,
              required: field.required,
              fk: field.editor,
            })),
        })),
      };
    } catch (error) {
      return {
        found: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown schema cache error",
      };
    }
  },
});

type RelationTuple = [
  sourceObject: string,
  sourceTable: string,
  sourceField: string,
  caption: string,
  targetObject: string,
  relationType: string,
];

type NormalizedRelation = {
  sourceObject: string;
  sourceTable: string;
  sourceField: string;
  caption: string;
  targetObject: string;
  relationType: string;
};

function normalizeRelationTuple(
  value: unknown,
): NormalizedRelation | null {
  if (!Array.isArray(value) || value.length < 6) {
    return null;
  }

  const [
    sourceObject,
    sourceTable,
    sourceField,
    caption,
    targetObject,
    relationType,
  ] = value;

  if (
    typeof sourceObject !== "string" ||
    typeof sourceTable !== "string" ||
    typeof sourceField !== "string" ||
    typeof caption !== "string" ||
    typeof targetObject !== "string" ||
    typeof relationType !== "string"
  ) {
    return null;
  }

  return {
    sourceObject,
    sourceTable,
    sourceField,
    caption,
    targetObject,
    relationType,
  };
}

export const softoneRelations = createTool({
  id: "softone-relations",

  description:
    "Returns outgoing and incoming SoftOne FK/editor relationships from the cached relations file.",

  inputSchema: z.object({
    object: z
      .string()
      .min(1)
      .describe(
        "SoftOne object, for example ITEM, CUSTOMER, SALDOC or COMPANY",
      ),
  }),

  execute: async ({ object }) => {
    const path =
      process.env.SOFTONE_RELATIONS_PATH ??
      "data/softone-full-relations.json";

    if (!existsSync(path)) {
      return {
        found: false,
        error: `SoftOne relations cache not found at ${path}`,
      };
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(
        readFileSync(path, "utf8"),
      ) as unknown;
    } catch (error) {
      return {
        found: false,
        error:
          "Could not parse SoftOne relations JSON: " +
          (error instanceof Error
            ? error.message
            : "unknown error"),
      };
    }

    if (!Array.isArray(parsed)) {
      return {
        found: false,
        error:
          "SoftOne relations file must contain a top-level array.",
      };
    }

    const objectName =
      object.trim().toUpperCase();

    const relations = parsed
      .map(normalizeRelationTuple)
      .filter(
        (
          relation,
        ): relation is NormalizedRelation =>
          relation !== null,
      );

    const outgoing = relations.filter(
      (relation) =>
        relation.sourceObject
          .trim()
          .toUpperCase() === objectName,
    );

    const incoming = relations.filter(
      (relation) =>
        relation.targetObject
          .trim()
          .toUpperCase() === objectName,
    );

    return {
      found: true,
      object: objectName,

      sourceRecords: parsed.length,
      validRelations: relations.length,
      skippedRelations:
        parsed.length - relations.length,

      outgoing,
      incoming,
    };
  },
});
