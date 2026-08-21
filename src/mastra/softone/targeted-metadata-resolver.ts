import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  gunzipSync,
} from "node:zlib";

import {
  dirname,
  resolve,
} from "node:path";

import {
  createHash,
} from "node:crypto";

import {
  callSoftOneAuthenticated,
} from "../tools/softone";

import {
  getSoftOneConnection,
} from "./connection-provider";


type GenericRecord =
  Record<string, unknown>;


type BaselineField = {
  name:
    string;

  caption?:
    string;

  type?:
    string;

  required?:
    boolean;

  editor?:
    string | null;
};


type BaselineTable = {
  name:
    string;

  fields?:
    BaselineField[];
};


type BaselineObject = {
  caption?:
    string;

  type?:
    string;

  tables?:
    BaselineTable[];
};


type BaselineSchema =
  Record<
    string,
    BaselineObject
  >;


export type SoftOneResolvedField = {
  name:
    string;

  fullname?:
    string;

  caption?:
    string;

  type?:
    string;

  editor?:
    string;

  required?:
    boolean;

  raw?:
    GenericRecord;
};


export type SoftOneResolvedTable = {
  name:
    string;

  physicalName?:
    string;

  caption?:
    string;

  fillType?:
    string;

  fields:
    Record<
      string,
      SoftOneResolvedField
    >;
};


type CachedObject = {
  object:
    string;

  type?:
    string;

  caption?:
    string;

  tables:
    Record<
      string,
      SoftOneResolvedTable
    >;

  discoveredAt:
    string;
};


type ContextCache = {
  schemaVersion:
    1;

  context: {
    tenantId:
      string;

    connectionId:
      string;

    environment:
      string;

    company:
      string;

    branch:
      string;

    module:
      string;

    appIdHash:
      string;
  };

  objects:
    Record<
      string,
      CachedObject
    >;
};


export type SoftOneMetadataResolution = {
  found:
    boolean;

  source:
    | "GLOBAL_BASELINE"
    | "AUTHENTICATED_CONTEXT_CACHE"
    | "LIVE_WEB_SERVICE_DISCOVERY"
    | "UNRESOLVED";

  liveRequestPerformed:
    boolean;

  object:
    string;

  table?:
    SoftOneResolvedTable;

  field?:
    SoftOneResolvedField;

  message:
    string;
};


function canonical(
  value:
    string,
): string {
  return value
    .trim()
    .toUpperCase();
}


function text(
  value:
    unknown,
): string | undefined {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }


  const result =
    String(
      value,
    ).trim();


  return result ||
    undefined;
}


function bool(
  value:
    unknown,
): boolean | undefined {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }


  if (
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() ===
      "true"
  ) {
    return true;
  }


  if (
    value === 0 ||
    value === "0" ||
    String(value).toLowerCase() ===
      "false"
  ) {
    return false;
  }


  return undefined;
}


let baselineCache:
  BaselineSchema | undefined;


function loadBaseline():
  BaselineSchema {
  if (
    baselineCache
  ) {
    return baselineCache;
  }


  const path =
    resolve(
      process.cwd(),
      process.env
        .SOFTONE_SCHEMA_PATH ??
      "data/softone-full-schema.json.gz",
    );


  if (
    !existsSync(
      path,
    )
  ) {
    baselineCache =
      {};

    return baselineCache;
  }


  baselineCache =
    JSON.parse(
      gunzipSync(
        readFileSync(
          path,
        ),
      ).toString(
        "utf8",
      ),
    ) as BaselineSchema;


  return baselineCache;
}


function findBaseline(
  objectName:
    string,

  tableName?:
    string,

  fieldName?:
    string,
): SoftOneMetadataResolution | undefined {
  /*
   * CCC* identifiers are installation/customer customizations.
   *
   * They must never be promoted to GLOBAL truth even if an
   * imported baseline snapshot happens to contain them.
   * Resolve them from authenticated-context cache/live metadata.
   */
  if (
    fieldName &&
    canonical(
      fieldName,
    ).startsWith(
      "CCC",
    )
  ) {
    return undefined;
  }


  const schema =
    loadBaseline();


  const object =
    schema[
      canonical(
        objectName,
      )
    ];


  if (
    !object
  ) {
    return undefined;
  }


  if (
    !tableName
  ) {
    return {
      found:
        true,

      source:
        "GLOBAL_BASELINE",

      liveRequestPerformed:
        false,

      object:
        canonical(
          objectName,
        ),

      message:
        "Object resolved from global baseline.",
    };
  }


  const table =
    object.tables?.find(
      candidate =>
        canonical(
          candidate.name,
        ) ===
        canonical(
          tableName,
        ),
    );


  if (
    !table
  ) {
    return undefined;
  }


  const resolvedTable:
    SoftOneResolvedTable = {
      name:
        canonical(
          table.name,
        ),

      fields:
        Object.fromEntries(
          (
            table.fields ??
            []
          ).map(
            field => [
              canonical(
                field.name,
              ),
              {
                ...field,

                name:
                  field.name,

                editor:
                  field.editor ??
                  undefined,
              },
            ],
          ),
        ),
    };


  if (
    !fieldName
  ) {
    return {
      found:
        true,

      source:
        "GLOBAL_BASELINE",

      liveRequestPerformed:
        false,

      object:
        canonical(
          objectName,
        ),

      table:
        resolvedTable,

      message:
        "Table resolved from global baseline.",
    };
  }


  const field =
    Object.values(
      resolvedTable.fields,
    ).find(
      candidate =>
        canonical(
          candidate.name,
        ) ===
        canonical(
          fieldName,
        ),
    );


  if (
    !field
  ) {
    return undefined;
  }


  return {
    found:
      true,

    source:
      "GLOBAL_BASELINE",

    liveRequestPerformed:
      false,

    object:
      canonical(
        objectName,
      ),

    table:
      resolvedTable,

    field,

    message:
      "Field resolved from global baseline.",
  };
}


async function contextInfo(
  connectionId:
    string,
) {
  const connection =
    await getSoftOneConnection(
      connectionId,
    );


  const appIdHash =
    createHash(
      "sha256",
    )
      .update(
        connection.appId,
      )
      .digest(
        "hex",
      )
      .slice(
        0,
        16,
      );


  const cachePath =
    resolve(
      process.cwd(),
      "data",
      "softone-context-cache",
      connection.tenantId,
      `${connection.id}.json`,
    );


  return {
    connection,
    appIdHash,
    cachePath,
  };
}


async function loadContextCache(
  connectionId:
    string,
): Promise<{
  cache:
    ContextCache;

  cachePath:
    string;
}> {
  const {
    connection,
    appIdHash,
    cachePath,
  } =
    await contextInfo(
      connectionId,
    );


  try {
    const parsed =
      JSON.parse(
        await readFile(
          cachePath,
          "utf8",
        ),
      ) as ContextCache;


    const sameContext =
      parsed.schemaVersion ===
        1 &&
      parsed.context
        ?.tenantId ===
        connection.tenantId &&
      parsed.context
        ?.connectionId ===
        connection.id &&
      parsed.context
        ?.company ===
        connection.company &&
      parsed.context
        ?.branch ===
        connection.branch &&
      parsed.context
        ?.module ===
        connection.module &&
      parsed.context
        ?.appIdHash ===
        appIdHash;


    if (
      sameContext
    ) {
      return {
        cache:
          parsed,

        cachePath,
      };
    }
  }
  catch {
    // no valid context cache yet
  }


  return {
    cache: {
      schemaVersion:
        1,

      context: {
        tenantId:
          connection.tenantId,

        connectionId:
          connection.id,

        environment:
          connection.environment,

        company:
          connection.company,

        branch:
          connection.branch,

        module:
          connection.module,

        appIdHash,
      },

      objects:
        {},
    },

    cachePath,
  };
}


async function saveContextCache(
  cachePath:
    string,

  cache:
    ContextCache,
): Promise<void> {
  await mkdir(
    dirname(
      cachePath,
    ),
    {
      recursive:
        true,
    },
  );


  await writeFile(
    cachePath,
    JSON.stringify(
      cache,
      null,
      2,
    ) +
      "\n",
    "utf8",
  );
}


function findCached(
  cache:
    ContextCache,

  objectName:
    string,

  tableName?:
    string,

  fieldName?:
    string,
): SoftOneMetadataResolution | undefined {
  const object =
    cache.objects[
      canonical(
        objectName,
      )
    ];


  if (
    !object
  ) {
    return undefined;
  }


  if (
    !tableName
  ) {
    return {
      found:
        true,

      source:
        "AUTHENTICATED_CONTEXT_CACHE",

      liveRequestPerformed:
        false,

      object:
        object.object,

      message:
        "Object resolved from authenticated-context cache.",
    };
  }


  const table =
    object.tables[
      canonical(
        tableName,
      )
    ];


  if (
    !table
  ) {
    return undefined;
  }


  if (
    !fieldName
  ) {
    return {
      found:
        true,

      source:
        "AUTHENTICATED_CONTEXT_CACHE",

      liveRequestPerformed:
        false,

      object:
        object.object,

      table,

      message:
        "Table resolved from authenticated-context cache.",
    };
  }


  const field =
    table.fields[
      canonical(
        fieldName,
      )
    ];


  if (
    !field
  ) {
    return undefined;
  }


  return {
    found:
      true,

    source:
      "AUTHENTICATED_CONTEXT_CACHE",

    liveRequestPerformed:
      false,

    object:
      object.object,

    table,

    field,

    message:
      "Field resolved from authenticated-context cache.",
  };
}


async function discoverLive(
  connectionId:
    string,

  objectName:
    string,

  tableName?:
    string,
): Promise<CachedObject | undefined> {
  const object =
    canonical(
      objectName,
    );


  const tablesResponse =
    await callSoftOneAuthenticated<{
      success?:
        boolean;

      error?:
        string;

      count?:
        number;

      tables?:
        GenericRecord[];
    }>(
      connectionId,
      {
        service:
          "getObjectTables",

        OBJECT:
          object,
      },
    );


  if (
    tablesResponse.success !==
      true ||
    !Array.isArray(
      tablesResponse.tables,
    )
  ) {
    return undefined;
  }


  const requestedTable =
    tableName
      ? canonical(
          tableName,
        )
      : undefined;


  const selectedTables =
    tablesResponse.tables.filter(
      (
        rawTable:
          GenericRecord,
      ) => {
        const logicalName =
          canonical(
            text(
              rawTable.name,
            ) ??
            "",
          );


        return (
          !!logicalName &&
          (
            !requestedTable ||
            logicalName ===
              requestedTable
          )
        );
      },
    );


  const resolvedTables:
    Record<
      string,
      SoftOneResolvedTable
    > =
    {};


  for (
    const rawTable
    of selectedTables
  ) {
    const logicalName =
      canonical(
        text(
          rawTable.name,
        ) ??
        "",
      );


    if (
      !logicalName
    ) {
      continue;
    }


    const physicalName =
      text(
        rawTable.dbname,
      );


    const fillType =
      text(
        rawTable.filltype,
      );


    const resolvedTable:
      SoftOneResolvedTable = {
        name:
          logicalName,

        physicalName,

        caption:
          text(
            rawTable.caption,
          ),

        fillType,

        fields:
          {},
      };


    resolvedTables[
      logicalName
    ] =
      resolvedTable;


    /*
     * Buffer/Function tables are metadata entities,
     * not physical SQL tables.
     */
    if (
      canonical(
        fillType ??
        "",
      ) !==
        "SQL" ||
      !physicalName
    ) {
      continue;
    }


    const fieldsResponse =
      await callSoftOneAuthenticated<{
        success?:
          boolean;

        error?:
          string;

        fields?:
          GenericRecord[];
      }>(
        connectionId,
        {
          service:
            "getTableFields",

          OBJECT:
            object,

          TABLE:
            logicalName,
        },
      );


    if (
      fieldsResponse.success !==
        true ||
      !Array.isArray(
        fieldsResponse.fields,
      )
    ) {
      continue;
    }


    for (
      const rawField
      of fieldsResponse.fields
    ) {
      const fieldName =
        text(
          rawField.name,
        );


      if (
        !fieldName
      ) {
        continue;
      }


      resolvedTable.fields[
        canonical(
          fieldName,
        )
      ] = {
        name:
          fieldName,

        fullname:
          text(
            rawField.fullname,
          ),

        caption:
          text(
            rawField.caption,
          ),

        type:
          text(
            rawField.type,
          ),

        editor:
          text(
            rawField.editor,
          ),

        required:
          bool(
            rawField.required,
          ),

        raw:
          rawField,
      };
    }
  }


  return {
    object,

    tables:
      resolvedTables,

    discoveredAt:
      new Date()
        .toISOString(),
  };
}


export async function resolveSoftOneMetadata(
  input: {
    connectionId:
      string;

    object:
      string;

    table?:
      string;

    field?:
      string;

    /*
     * Normally true:
     * use verified global knowledge first and only
     * call the tenant when necessary.
     */
    preferBaseline?:
      boolean;
  },
): Promise<
  SoftOneMetadataResolution
> {
  const objectName =
    canonical(
      input.object,
    );


  const tableName =
    input.table
      ? canonical(
          input.table,
        )
      : undefined;


  const fieldName =
    input.field
      ? canonical(
          input.field,
        )
      : undefined;


  /*
   * 1. Common verified knowledge.
   */
  if (
    input.preferBaseline !==
      false
  ) {
    const baseline =
      findBaseline(
        objectName,
        tableName,
        fieldName,
      );


    if (
      baseline
    ) {
      return baseline;
    }
  }


  /*
   * 2. Tenant/context delta cache.
   */
  const {
    cache,
    cachePath,
  } =
    await loadContextCache(
      input.connectionId,
    );


  const cached =
    findCached(
      cache,
      objectName,
      tableName,
      fieldName,
    );


  if (
    cached
  ) {
    return cached;
  }


  /*
   * 3. Targeted live request.
   *
   * If a table is known, only that table's fields
   * are requested.
   */
  const discovered =
    await discoverLive(
      input.connectionId,
      objectName,
      tableName,
    );


  if (
    discovered
  ) {
    const previous =
      cache.objects[
        objectName
      ];


    cache.objects[
      objectName
    ] = {
      ...previous,
      ...discovered,

      tables: {
        ...previous?.tables,
        ...discovered.tables,
      },
    };


    await saveContextCache(
      cachePath,
      cache,
    );


    const liveResult =
      findCached(
        cache,
        objectName,
        tableName,
        fieldName,
      );


    if (
      liveResult
    ) {
      return {
        ...liveResult,

        source:
          "LIVE_WEB_SERVICE_DISCOVERY",

        liveRequestPerformed:
          true,

        message:
          "Metadata resolved by targeted live SoftOne discovery and cached for this authenticated context.",
      };
    }
  }


  return {
    found:
      false,

    source:
      "UNRESOLVED",

    liveRequestPerformed:
      true,

    object:
      objectName,

    message:
      "Identifier was not exposed by verified baseline, authenticated-context cache, or targeted live discovery.",
  };
}
