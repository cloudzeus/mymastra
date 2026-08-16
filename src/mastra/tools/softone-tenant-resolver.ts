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
  getSoftOneReferenceCatalogEntry,
} from "../softone/reference-catalog";

import {
  getSoftOneLookupRecipe,
} from "../softone/lookup-recipes";

type SchemaField = {
  name?: string;
  caption?: string;
  type?: string;
  editor?: string;
  defaultvalue?: string;
  required?: boolean;
  readOnly?: boolean;
  calculated?: boolean;
};

type SchemaTable = {
  name?: string;
  dbname?: string;
  caption?: string;
  fields?: SchemaField[];
};

type SchemaObject = {
  type?: string;
  caption?: string;
  tables?: SchemaTable[];
};

type SchemaRoot =
  Record<string, SchemaObject>;

type Relation = {
  sourceObject: string;
  sourceTable: string;
  sourceField: string;
  caption: string;
  targetObject: string;
  relationType: string;
};

let schemaCache:
  SchemaRoot | null = null;

let relationsCache:
  Relation[] | null = null;

function normalize(
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

function loadSchema(): SchemaRoot {
  if (schemaCache) {
    return schemaCache;
  }

  const path =
    process.env.SOFTONE_SCHEMA_PATH ??
    "data/softone-full-schema.json.gz";

  if (!existsSync(path)) {
    throw new Error(
      `SoftOne schema cache not found: ${path}`,
    );
  }

  const parsed =
    JSON.parse(
      gunzipSync(
        readFileSync(path),
      ).toString("utf8"),
    ) as unknown;

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

function loadRelations(): Relation[] {
  if (relationsCache) {
    return relationsCache;
  }

  const path =
    process.env.SOFTONE_RELATIONS_PATH ??
    "data/softone-full-relations.json";

  if (!existsSync(path)) {
    throw new Error(
      `SoftOne relations cache not found: ${path}`,
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
      "SoftOne relations cache must be an array",
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
    })
    .filter(
      (
        value,
      ): value is Relation =>
        value !== null,
    );

  return relationsCache;
}

function resolveSchemaObject(
  query: string,
  schema: SchemaRoot,
): string | null {
  const q =
    normalize(query);

  for (
    const object of
    Object.keys(schema)
  ) {
    if (
      normalize(object) === q
    ) {
      return object;
    }
  }

  return null;
}

function findField(
  schemaObject: SchemaObject,
  fieldQuery: string,
) {
  const q =
    normalize(fieldQuery);

  for (
    const table of
    schemaObject.tables ?? []
  ) {
    for (
      const field of
      table.fields ?? []
    ) {
      if (
        field.name &&
        normalize(
          field.name,
        ) === q
      ) {
        return {
          table,
          field,
        };
      }
    }
  }

  return null;
}

export const softoneTenantReferenceResolver =
  createTool({
    id: "softone-tenant-reference-resolver",

    description: `
Builds a read-only tenant reference resolution plan for a SoftOne field.

This tool does NOT execute writes.

It combines:
- SCHEMA_CACHE
- RELATIONS_CACHE
- canonical reference catalog
- lookup recipe registry

It must never invent a live SoftOne API recipe.

If no verified recipe exists, it returns LOOKUP_RECIPE_REQUIRED.
`,

    inputSchema: z.object({
      object: z
        .string()
        .min(1),

      field: z
        .string()
        .min(1),

      requestedValue: z
        .unknown()
        .optional(),
    }),

    execute: async ({
      object,
      field,
      requestedValue,
    }) => {
      const schema =
        loadSchema();

      const relations =
        loadRelations();

      const resolvedObject =
        resolveSchemaObject(
          object,
          schema,
        );

      if (!resolvedObject) {
        return {
          status:
            "OBJECT_UNRESOLVED",

          object,

          field,

          liveCallPerformed:
            false,

          writePerformed:
            false,
        };
      }

      const schemaObject =
        schema[resolvedObject];

      const found =
        findField(
          schemaObject,
          field,
        );

      if (!found) {
        return {
          status:
            "FIELD_UNRESOLVED",

          object:
            resolvedObject,

          field,

          liveCallPerformed:
            false,

          writePerformed:
            false,
        };
      }

      const {
        table,
        field: schemaField,
      } = found;

      const tableName =
        table.name ??
        table.dbname ??
        "";

      const editor =
        schemaField.editor?.trim() ??
        "";

      const relationMatches =
        relations.filter(
          relation =>
            normalize(
              relation.sourceObject,
            ) ===
              normalize(
                resolvedObject,
              ) &&
            normalize(
              relation.sourceTable,
            ) ===
              normalize(
                tableName,
              ) &&
            normalize(
              relation.sourceField,
            ) ===
              normalize(
                schemaField.name ??
                  field,
              ),
        );

      const relationTargets =
        Array.from(
          new Set(
            relationMatches.map(
              relation =>
                relation.targetObject,
            ),
          ),
        );

      const serverManaged =
        schemaField.readOnly ===
          true ||
        schemaField.calculated ===
          true ||
        schemaField.type ===
          "AutoInc";

      let lookupKind:
        | "NONE"
        | "OBJECT_REFERENCE"
        | "INTERNAL_EDITOR"
        | "EDITOR_METADATA"
        | "COMMAND_EDITOR";

      let targetObject:
        string | null = null;

      if (serverManaged) {
        lookupKind = "NONE";
      } else if (
        editor
          .toUpperCase()
          .startsWith(
            "XCMD:",
          )
      ) {
        lookupKind =
          "COMMAND_EDITOR";
      } else if (
        editor.startsWith("$")
      ) {
        lookupKind =
          "INTERNAL_EDITOR";
      } else if (
        relationTargets.length >
        0
      ) {
        lookupKind =
          "OBJECT_REFERENCE";

        targetObject =
          relationTargets.length ===
          1
            ? relationTargets[0]
            : null;
      } else if (editor) {
        lookupKind =
          "EDITOR_METADATA";
      } else {
        lookupKind = "NONE";
      }

      /*
       * Catalog lookup priority:
       *
       * 1. verified relation target
       * 2. exact editor key
       */
      const catalogKey =
        targetObject ??
        (
          editor
            ? editor
            : null
        );

      const referenceCatalog =
        catalogKey
          ? getSoftOneReferenceCatalogEntry(
              catalogKey,
            )
          : null;

      const lookupRecipe =
        catalogKey
          ? getSoftOneLookupRecipe(
              catalogKey,
            )
          : null;

      const requiresTenantLookup =
        lookupKind ===
          "OBJECT_REFERENCE";

      const verifiedLookupRecipe =
        lookupRecipe?.status ===
          "VERIFIED";

      let status:
        | "NO_TENANT_LOOKUP_REQUIRED"
        | "LOOKUP_RECIPE_REQUIRED"
        | "READY_FOR_READ_LOOKUP";

      if (!requiresTenantLookup) {
        status =
          "NO_TENANT_LOOKUP_REQUIRED";
      } else if (
        verifiedLookupRecipe
      ) {
        status =
          "READY_FOR_READ_LOOKUP";
      } else {
        status =
          "LOOKUP_RECIPE_REQUIRED";
      }

      return {
        status,

        object:
          resolvedObject,

        table: {
          name:
            table.name ??
            null,

          dbname:
            table.dbname ??
            null,
        },

        field: {
          name:
            schemaField.name ??
            field,

          caption:
            schemaField.caption ??
            null,

          type:
            schemaField.type ??
            null,

          editor:
            editor || null,

          required:
            schemaField.required ===
            true,

          readOnly:
            schemaField.readOnly ===
            true,

          calculated:
            schemaField.calculated ===
            true,

          defaultValue:
            schemaField.defaultvalue ??
            null,
        },

        resolution: {
          lookupKind,

          targetObject,

          relationTargets,

          relationTypes:
            Array.from(
              new Set(
                relationMatches.map(
                  relation =>
                    relation.relationType,
                ),
              ),
            ),

          serverManaged,

          requiresTenantLookup,

          verifiedLookupRecipe,

          requestedValue:
            requestedValue ??
            null,
        },

        referenceCatalog,

        lookupRecipe: lookupRecipe
          ? {
              target:
                lookupRecipe.target,

              status:
                lookupRecipe.status,

              operation:
                lookupRecipe.operation,

              requestTemplate:
                lookupRecipe.requestTemplate,

              valueField:
                lookupRecipe.valueField,

              labelFields:
                lookupRecipe.labelFields,

              tenantScoped:
                lookupRecipe.tenantScoped,

              readOnly:
                lookupRecipe.readOnly,

              provenance:
                lookupRecipe.provenance,
            }
          : null,

        relationEvidence:
          relationMatches,

        provenance: {
          field:
            "SCHEMA_CACHE",

          relation:
            relationMatches.length >
            0
              ? "RELATIONS_CACHE"
              : null,

          referenceCatalog:
            referenceCatalog
              ? "REFERENCE_CATALOG"
              : null,

          lookupRecipe:
            lookupRecipe
              ? "LOOKUP_RECIPE_REGISTRY"
              : null,

          liveValue:
            null,
        },

        liveCallPerformed:
          false,

        writePerformed:
          false,

        instruction:
          status ===
          "LOOKUP_RECIPE_REQUIRED"
            ? "Reference is identified, but no verified read-only live lookup recipe exists yet."
            : status ===
              "READY_FOR_READ_LOOKUP"
              ? "A verified read-only lookup recipe exists. Live execution may be performed by an approved read-only executor."
              : "No tenant object lookup is required for this field.",
      };
    },
  });
