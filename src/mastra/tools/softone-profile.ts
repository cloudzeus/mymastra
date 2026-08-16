import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  gunzipSync,
} from "node:zlib";

import {
  getSoftOneObjectRegistryEntry,
  normalizeSoftOneObjectName,
} from "../softone/registry";

/*
 * ============================================================
 * Types
 * ============================================================
 */

type SchemaField = {
  name?: string;
  alias?: string;
  fullname?: string;
  caption?: string;
  size?: string;
  type?: string;
  edittype?: string;
  xtype?: string;
  defaultvalue?: string;
  decimals?: string;
  editor?: string;
  readOnly?: boolean;
  visible?: boolean;
  required?: boolean;
  calculated?: boolean;
  fk?: string;
};

type SchemaTable = {
  name?: string;
  dbname?: string;
  caption?: string;
  filltype?: string;
  fields?: SchemaField[];
};

type SchemaObject = {
  type?: string;
  caption?: string;
  tables?: SchemaTable[];
};

type SchemaRoot = Record<
  string,
  SchemaObject
>;

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

type ResolutionCandidate = {
  object: string;
  caption: string | null;
  type: string | null;
  score: number;
  matchedBy: string[];
  registryVerified: boolean;
};

/*
 * ============================================================
 * Cache
 * ============================================================
 */

let schemaCache: SchemaRoot | null =
  null;

let relationsCache:
  | NormalizedRelation[]
  | null = null;

/*
 * ============================================================
 * Normalization
 * ============================================================
 */

function normalizeText(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/*
 * ============================================================
 * Schema loader
 * ============================================================
 */

function loadSchema(): SchemaRoot {
  if (schemaCache) {
    return schemaCache;
  }

  const path =
    process.env.SOFTONE_SCHEMA_PATH ??
    "data/softone-full-schema.json.gz";

  if (!existsSync(path)) {
    throw new Error(
      `SoftOne schema cache not found at ${path}`,
    );
  }

  const compressed =
    readFileSync(path);

  const json =
    gunzipSync(
      compressed,
    ).toString("utf8");

  const parsed =
    JSON.parse(json) as unknown;

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "SoftOne schema root must be an object",
    );
  }

  schemaCache =
    parsed as SchemaRoot;

  return schemaCache;
}

/*
 * ============================================================
 * Relations loader
 * ============================================================
 */

function loadRelations():
  NormalizedRelation[] {
  if (relationsCache) {
    return relationsCache;
  }

  const path =
    process.env
      .SOFTONE_RELATIONS_PATH ??
    "data/softone-full-relations.json";

  if (!existsSync(path)) {
    throw new Error(
      `SoftOne relations cache not found at ${path}`,
    );
  }

  const parsed =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    ) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(
      "SoftOne relations cache must contain an array",
    );
  }

  relationsCache = parsed
    .map(value => {
      if (
        !Array.isArray(value) ||
        value.length < 6
      ) {
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
        typeof sourceObject !==
          "string" ||
        typeof sourceTable !==
          "string" ||
        typeof sourceField !==
          "string" ||
        typeof caption !==
          "string" ||
        typeof targetObject !==
          "string" ||
        typeof relationType !==
          "string"
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
    })
    .filter(
      (
        value,
      ): value is NormalizedRelation =>
        value !== null,
    );

  return relationsCache;
}

/*
 * ============================================================
 * Discovery
 * ============================================================
 */

function scoreObject(
  query: string,
  object: string,
  schemaObject: SchemaObject,
): ResolutionCandidate {
  const q =
    normalizeText(query);

  const objectName =
    normalizeText(object);

  const caption =
    normalizeText(
      schemaObject.caption ?? "",
    );

  const registry =
    getSoftOneObjectRegistryEntry(
      object,
    );

  const aliases =
    registry?.aliases?.map(
      normalizeText,
    ) ?? [];

  const tableNames =
    (
      schemaObject.tables ?? []
    )
      .flatMap(table => [
        table.name
          ? normalizeText(
              table.name,
            )
          : "",
        table.dbname
          ? normalizeText(
              table.dbname,
            )
          : "",
      ])
      .filter(Boolean);

  let score = 0;

  const matchedBy: string[] = [];

  if (q === objectName) {
    score += 1000;
    matchedBy.push(
      "OBJECT_EXACT",
    );
  }

  if (aliases.includes(q)) {
    score += 950;
    matchedBy.push(
      "REGISTRY_ALIAS_EXACT",
    );
  }

  if (
    caption &&
    q === caption
  ) {
    score += 900;
    matchedBy.push(
      "CAPTION_EXACT",
    );
  }

  /*
   * Exact table match is useful,
   * but weaker than object identity.
   */
  if (
    tableNames.includes(q)
  ) {
    score += 300;
    matchedBy.push(
      "TABLE_EXACT",
    );
  }

  if (
    q.length >= 3 &&
    caption.includes(q)
  ) {
    score += 400;
    matchedBy.push(
      "CAPTION_PARTIAL",
    );
  }

  if (
    q.length >= 3 &&
    aliases.some(alias =>
      alias.includes(q),
    )
  ) {
    score += 350;
    matchedBy.push(
      "REGISTRY_ALIAS_PARTIAL",
    );
  }

  /*
   * Natural-language token matching
   * intentionally excludes table names.
   */
  const tokens = q
    .split(" ")
    .filter(
      token =>
        token.length >= 3,
    );

  if (tokens.length > 1) {
    const businessText = [
      objectName,
      caption,
      ...aliases,
    ].join(" ");

    const matched =
      tokens.filter(token =>
        businessText.includes(
          token,
        ),
      );

    if (matched.length > 0) {
      const coverage =
        matched.length /
        tokens.length;

      score += Math.round(
        coverage * 300,
      );

      matchedBy.push(
        `TOKEN_COVERAGE_${matched.length}_${tokens.length}`,
      );
    }
  }

  return {
    object,
    caption:
      schemaObject.caption ??
      null,

    type:
      schemaObject.type ??
      null,

    score,
    matchedBy,

    registryVerified:
      registry !== null,
  };
}

function resolveObject(
  query: string,
  schema: SchemaRoot,
) {
  const canonical =
    normalizeSoftOneObjectName(
      query,
    );

  const candidates =
    Object.entries(schema)
      .map(
        ([
          object,
          schemaObject,
        ]) => {
          const result =
            scoreObject(
              query,
              object,
              schemaObject,
            );

          /*
           * Canonical registry
           * normalization gets
           * an additional strong bonus.
           */
          if (
            canonical === object &&
            normalizeText(query) !==
              object
          ) {
            result.score += 500;

            result.matchedBy.push(
              "CANONICAL_NORMALIZATION",
            );
          }

          return result;
        },
      )
      .filter(
        candidate =>
          candidate.score > 0,
      )
      .sort(
        (a, b) =>
          b.score - a.score,
      );

  const best =
    candidates[0] ?? null;

  let confidence:
    | "HIGH"
    | "MEDIUM"
    | "LOW"
    | "NONE" = "NONE";

  if (best) {
    if (best.score >= 850) {
      confidence = "HIGH";
    } else if (
      best.score >= 500
    ) {
      confidence = "MEDIUM";
    } else {
      confidence = "LOW";
    }
  }

  return {
    confidence,
    best,
    candidates:
      candidates.slice(0, 5),
  };
}

/*
 * ============================================================
 * Field normalization
 * ============================================================
 */

function normalizeField(
  field: SchemaField,
) {
  return {
    name:
      field.name ?? null,

    caption:
      field.caption ?? null,

    type:
      field.type ?? null,

    size:
      field.size ?? null,

    editor:
      field.editor ?? null,

    defaultValue:
      field.defaultvalue ??
      null,

    required:
      field.required === true,

    readOnly:
      field.readOnly === true,

    calculated:
      field.calculated ===
      true,

    visible:
      field.visible !==
      false,

    fk:
      field.fk &&
      field.fk.trim()
        ? field.fk
        : null,
  };
}

/*
 * ============================================================
 * Tool
 * ============================================================
 */

export const softoneObjectProfile =
  createTool({
    id: "softone-object-profile",

    description: `
Returns a normalized, grounded SoftOne object profile suitable for
Business Analyst, Developer and QA agents.

It resolves a natural-language query or object name and returns:

- canonical object identity
- Web Services/schema master table
- physical SQL table when registry-verified
- primary key when registry-verified
- schema metadata
- required fields
- master fields
- child tables
- outgoing relations
- incoming relations
- schema-vs-relations discrepancies
- provenance and verification state

Use this as the preferred starting point for implementation-oriented
SoftOne work.
`,

    inputSchema: z.object({
      query: z
        .string()
        .min(1),

      detail: z
        .enum([
          "summary",
          "developer",
        ])
        .optional()
        .default(
          "developer",
        ),

      relationLimit: z
        .number()
        .int()
        .min(10)
        .max(500)
        .optional()
        .default(200),
    }),

    execute: async ({
      query,
      detail,
      relationLimit,
    }) => {
      const schema =
        loadSchema();

      const resolution =
        resolveObject(
          query,
          schema,
        );

      if (
        !resolution.best ||
        resolution.confidence ===
          "NONE" ||
        resolution.confidence ===
          "LOW"
      ) {
        return {
          found: false,

          query,

          resolution: {
            confidence:
              resolution.confidence,

            candidates:
              resolution.candidates,
          },

          instruction:
            "SoftOne object could not be resolved with sufficient confidence. Do not guess.",
        };
      }

      const object =
        resolution.best.object;

      const schemaObject =
        schema[object];

      if (!schemaObject) {
        return {
          found: false,
          query,
          object,
          error:
            "Resolved object does not exist in schema cache.",
        };
      }

      const registry =
        getSoftOneObjectRegistryEntry(
          object,
        );

      const tables =
        schemaObject.tables ?? [];

      const masterTable =
        tables[0] ?? null;

      const masterTableName =
        masterTable?.name ??
        masterTable?.dbname ??
        null;

      /*
       * Physical SQL mapping must be reconciled between:
       *
       * - canonical registry
       * - schema table.dbname
       *
       * Never silently choose one when they disagree.
       */
      const schemaPhysicalMasterTable =
        masterTable?.dbname ?? null;

      const registryPhysicalMasterTable =
        registry?.physicalMasterTable ?? null;

      let physicalMappingStatus:
        | "MATCH"
        | "SCHEMA_ONLY"
        | "REGISTRY_ONLY"
        | "MISMATCH"
        | "UNKNOWN" = "UNKNOWN";

      let effectivePhysicalMasterTable:
        string | null = null;

      if (
        schemaPhysicalMasterTable &&
        registryPhysicalMasterTable
      ) {
        if (
          normalizeText(schemaPhysicalMasterTable) ===
          normalizeText(registryPhysicalMasterTable)
        ) {
          physicalMappingStatus = "MATCH";
          effectivePhysicalMasterTable =
            registryPhysicalMasterTable;
        } else {
          physicalMappingStatus = "MISMATCH";
        }
      } else if (schemaPhysicalMasterTable) {
        physicalMappingStatus = "SCHEMA_ONLY";
        effectivePhysicalMasterTable =
          schemaPhysicalMasterTable;
      } else if (registryPhysicalMasterTable) {
        physicalMappingStatus = "REGISTRY_ONLY";
        effectivePhysicalMasterTable =
          registryPhysicalMasterTable;
      }

      const masterFields =
        (
          masterTable?.fields ??
          []
        ).map(
          normalizeField,
        );

      const requiredFields =
        masterFields.filter(
          field =>
            field.required,
        );

      /*
       * Fields that SoftOne appears to control itself.
       * These must not automatically be treated as explicit
       * INSERT inputs merely because required=true.
       */
      const serverManagedFields =
        masterFields.filter(
          field =>
            field.readOnly ||
            field.calculated ||
            field.type === "AutoInc",
        );

      /*
       * Schema-required fields that are plausible explicit
       * inputs. This is NOT the minimum successful payload.
       */
      const requiredInputCandidates =
        requiredFields.filter(
          field =>
            !field.readOnly &&
            !field.calculated &&
            field.type !== "AutoInc",
        );

      /*
       * Non-$ editors indicate references/lookups that may
       * require tenant-specific resolution.
       *
       * We call these reference candidates, not confirmed FK,
       * because schema editor metadata and relations metadata
       * are separate sources.
       */
      const referenceCandidates =
        masterFields
          .filter(
            field =>
              typeof field.editor === "string" &&
              field.editor.length > 0 &&
              !field.editor.startsWith("$"),
          )
          .map(field => ({
            field: field.name,
            editor: field.editor,
            caption: field.caption,
            required: field.required,
          }));

      /*
       * $-prefixed editors are internal SoftOne lists /
       * memory editors.
       */
      const internalEditorFields =
        masterFields
          .filter(
            field =>
              typeof field.editor === "string" &&
              field.editor.startsWith("$"),
          )
          .map(field => ({
            field: field.name,
            editor: field.editor,
            caption: field.caption,
            required: field.required,
            defaultValue: field.defaultValue,
          }));

      /*
       * AutoInc fields are only candidates for key semantics.
       * Registry remains authoritative for the canonical PK.
       */
      const autoIncFields =
        masterFields
          .filter(
            field =>
              field.type === "AutoInc",
          )
          .map(
            field => field.name,
          );

      const childTables =
        tables
          .slice(1)
          .map(table => {
            const fields =
              (
                table.fields ?? []
              ).map(
                normalizeField,
              );

            return {
              name:
                table.name ??
                null,

              dbname:
                table.dbname ??
                null,

              caption:
                table.caption ??
                null,

              fillType:
                table.filltype ??
                null,

              fieldCount:
                fields.length,

              requiredFields:
                fields.filter(
                  field =>
                    field.required,
                ),

              fields:
                detail ===
                "developer"
                  ? fields
                  : undefined,
            };
          });

      const relations =
        loadRelations();

      const outgoingAll =
        relations.filter(
          relation =>
            normalizeText(
              relation.sourceObject,
            ) ===
            normalizeText(object),
        );

      const incomingAll =
        relations.filter(
          relation =>
            normalizeText(
              relation.targetObject,
            ) ===
            normalizeText(object),
        );

      const outgoing =
        outgoingAll.slice(
          0,
          relationLimit,
        );

      const incoming =
        incomingAll.slice(
          0,
          relationLimit,
        );

      /*
       * ======================================================
       * Schema vs relations reconciliation
       * ======================================================
       */

      const schemaFkHints =
        masterFields
          .filter(
            field =>
              field.fk !== null,
          )
          .map(field => ({
            field:
              field.name,

            target:
              field.fk,
          }));

      const relationFieldMap =
        new Map<
          string,
          Set<string>
        >();

      for (
        const relation of
        outgoingAll
      ) {
        const key =
          normalizeText(
            relation.sourceField,
          );

        const targets =
          relationFieldMap.get(
            key,
          ) ??
          new Set<string>();

        targets.add(
          relation.targetObject,
        );

        relationFieldMap.set(
          key,
          targets,
        );
      }

      const discrepancies =
        schemaFkHints
          .map(hint => {
            if (!hint.field) {
              return null;
            }

            const relationTargets =
              Array.from(
                relationFieldMap.get(
                  normalizeText(
                    hint.field,
                  ),
                ) ??
                  [],
              );

            /*
             * $-prefixed FK hints are
             * internal SoftOne editors /
             * memory lists and do not
             * necessarily correspond to
             * object relations.
             */
            if (
              hint.target?.startsWith(
                "$",
              )
            ) {
              return null;
            }

            if (
              relationTargets.length ===
              0
            ) {
              return {
                field:
                  hint.field,

                schemaTarget:
                  hint.target,

                relationsTargets:
                  [],

                status:
                  "SCHEMA_ONLY",
              };
            }

            const targetMatches =
              relationTargets.some(
                target =>
                  normalizeText(
                    target,
                  ) ===
                  normalizeText(
                    hint.target ??
                      "",
                  ),
              );

            if (!targetMatches) {
              return {
                field:
                  hint.field,

                schemaTarget:
                  hint.target,

                relationsTargets:
                  relationTargets,

                status:
                  "TARGET_MISMATCH",
              };
            }

            return null;
          })
          .filter(
            (
              value,
            ): value is {
              field: string;
              schemaTarget:
                string | null;
              relationsTargets:
                string[];
              status:
                | "SCHEMA_ONLY"
                | "TARGET_MISMATCH";
            } =>
              value !== null,
          );

      return {
        found: true,

        query,

        resolution: {
          confidence:
            resolution.confidence,

          matchedBy:
            resolution.best
              .matchedBy,

          score:
            resolution.best
              .score,

          alternatives:
            resolution.candidates
              .slice(1),
        },

        identity: {
          object,

          caption:
            schemaObject.caption ??
            registry
              ?.description ??
            null,

          objectType:
            schemaObject.type ??
            null,

          webServiceMasterTable:
            registry
              ?.webServiceMasterTable ??
            masterTableName,

          physicalMasterTable:
            effectivePhysicalMasterTable,

          physicalMappingStatus,

          schemaPhysicalMasterTable,

          registryPhysicalMasterTable,

          primaryKey:
            registry
              ?.primaryKey ??
            null,

          registryVerified:
            registry !== null,

          aliases:
            registry?.aliases ??
            [],
        },

        schema: {
          masterTable: {
            name:
              masterTable?.name ??
              null,

            dbname:
              masterTable?.dbname ??
              null,

            caption:
              masterTable?.caption ??
              null,

            fillType:
              masterTable?.filltype ??
              null,

            fieldCount:
              masterFields.length,
          },

          requiredFields,

          masterFields:
            detail ===
            "developer"
              ? masterFields
              : undefined,

          childTableCount:
            childTables.length,

          childTables,
        },

        relations: {
          outgoingCount:
            outgoingAll.length,

          incomingCount:
            incomingAll.length,

          returnedOutgoing:
            outgoing.length,

          returnedIncoming:
            incoming.length,

          truncated:
            outgoing.length <
              outgoingAll.length ||
            incoming.length <
              incomingAll.length,

          outgoing,

          incoming,
        },

        reconciliation: {
          schemaFkHintCount:
            schemaFkHints.length,

          discrepancyCount:
            discrepancies.length,

          discrepancies,
        },

        implementationContract: {
          version: 2,

          object,

          objectType:
            schemaObject.type ?? null,

          api: {
            object,
            masterTable:
              masterTableName,
          },

          database: {
            physicalMasterTable:
              effectivePhysicalMasterTable,

            mappingStatus:
              physicalMappingStatus,

            schemaDbName:
              schemaPhysicalMasterTable,

            registryDbName:
              registryPhysicalMasterTable,

            primaryKey:
              registry?.primaryKey ??
              null,

            autoIncFieldCandidates:
              autoIncFields,
          },

          fields: {
            total:
              masterFields.length,

            schemaRequired:
              requiredFields,

            serverManaged:
              serverManagedFields,

            requiredInputCandidates,

            referenceCandidates,

            internalEditors:
              internalEditorFields,
          },

          details: childTables.map(
            table => ({
              name:
                table.name,

              dbname:
                table.dbname,

              caption:
                table.caption,

              fillType:
                table.fillType,

              fieldCount:
                table.fieldCount,

              requiredFields:
                table.requiredFields,
            }),
          ),

          relations: {
            outgoingCount:
              outgoingAll.length,

            incomingCount:
              incomingAll.length,

            outgoing,

            incoming,
          },

          discrepancies,

          readiness: {
            /*
             * Cached metadata is sufficient to design and
             * implement read-side integration structures.
             */
            readImplementation:
              "READY_FROM_CACHE",

            /*
             * Writes remain blocked because:
             * - minimum successful setData payload is unknown
             * - tenant IDs may be unresolved
             * - defaults/business logic may be tenant-specific
             */
            writeImplementation:
              "NOT_VERIFIED",

            executableWritePayload:
              false,

            minimumSuccessfulSetDataPayload:
              "UNVERIFIED",

            tenantSpecificValues:
              "UNRESOLVED",
          },

          developerRules: [
            "Use object as the SoftOne Web Services object.",
            "Do not confuse schema table name with physical SQL dbname.",
            "Treat schema required=true as schema metadata, not proof of mandatory explicit INSERT input.",
            "Do not invent tenant-specific IDs.",
            "Resolve references before emitting executable write payloads.",
            "Do not perform writes without an approved write workflow.",
          ],
        },

        provenance: {
          resolution: [
            "REGISTRY",
            "SCHEMA_CACHE",
          ],

          identity: registry
            ? [
                "REGISTRY",
                "SCHEMA_CACHE",
              ]
            : [
                "SCHEMA_CACHE",
              ],

          schema:
            "SCHEMA_CACHE",

          relations:
            "RELATIONS_CACHE",

          physicalSqlMapping: {
            status:
              physicalMappingStatus,

            registry:
              registryPhysicalMasterTable
                ? "REGISTRY"
                : null,

            schema:
              schemaPhysicalMasterTable
                ? "SCHEMA_CACHE"
                : null,
          },
        },

        implementationSafety: {
          minimumSuccessfulSetDataPayload:
            "UNVERIFIED",

          tenantSpecificIds:
            "UNRESOLVED",

          liveApiUsed:
            false,

          writesPerformed:
            false,

          instruction:
            "Do not invent tenant-specific IDs, defaults or write payload values. Resolve them from verified sources before implementation.",
        },
      };
    },
  });
