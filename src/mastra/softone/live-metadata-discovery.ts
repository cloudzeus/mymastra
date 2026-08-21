import {
  mkdir,
  writeFile,
} from "node:fs/promises";

import {
  dirname,
  resolve,
} from "node:path";

import {
  createHash,
} from "node:crypto";

import {
  getSoftOneConnection,
} from "./connection-provider";

import {
  callSoftOneAuthenticated,
} from "../tools/softone";


export type SoftOneLiveMetadataVerification =
  "TENANT_VERIFIED";


export interface SoftOneLiveField {
  name: string;

  alias?: string;

  fullname?: string;

  caption?: string;

  size?: string;

  type?: string;

  editType?: string;

  xType?: string;

  defaultValue?: string;

  decimals?: string;

  editor?: string;

  readOnly?: boolean;

  visible?: boolean;

  required?: boolean;

  calculated?: boolean;

  /*
   * Live SoftOne relationship/link metadata.
   * Preserved verbatim for later deterministic
   * relation extraction.
   */
  links?: unknown[];

  raw:
    Record<string, unknown>;
}


export interface SoftOneLiveTable {
  name: string;

  physicalName?: string;

  caption?: string;

  /*
   * SoftOne getTableFields may report a larger count
   * than the number of field records actually returned.
   *
   * Returned fields are tenant-verified.
   * Absence is authoritative only when
   * fieldMetadataComplete === true.
   */
  reportedFieldCount?:
    number;

  returnedFieldCount?:
    number;

  visibilityScope?:
    "AUTHENTICATED_CONTEXT";

  /*
   * Fields exposed by this exact authenticated SoftOne
   * installation/user/company/branch/module/appId context.
   */


  /*
   * Diagnostic only.
   *
   * SoftOne may expose fields according to installation,
   * authenticated user, company, branch, module and appId.
   *
   * Therefore reportedCount != returnedFieldCount does NOT
   * imply pagination or incomplete discovery.
   */
  fieldMetadataComplete?:
    boolean;

  fields:
    Record<
      string,
      SoftOneLiveField
    >;

  raw:
    Record<string, unknown>;
}


export interface SoftOneLiveObject {
  name: string;

  caption?: string;

  type?: string;

  tables:
    Record<
      string,
      SoftOneLiveTable
    >;

  raw:
    Record<string, unknown>;
}


export interface SoftOneLiveDiscoveryFailure {
  stage:
    | "GET_OBJECTS"
    | "GET_OBJECT_TABLES"
    | "GET_TABLE_FIELDS";

  object?: string;

  table?: string;

  error: string;
}


export interface SoftOneLiveMetadataSnapshot {
  schemaVersion:
    1;

  source: {
    type:
      "LIVE_WEB_SERVICE_DISCOVERY";

    verification:
      SoftOneLiveMetadataVerification;

    scope:
      "TENANT";

    tenantId:
      string;

    connectionId:
      string;

    connectionName:
      string;

    environment:
      "PRODUCTION"
      | "TEST"
      | "DEVELOPMENT";

    company:
      string;

    branch:
      string;

    module:
      string;

    retrievedAt:
      string;
  };

  statistics: {
    objects:
      number;

    tables:
      number;

    fields:
      number;

    failures:
      number;
  };

  objects:
    Record<
      string,
      SoftOneLiveObject
    >;

  failures:
    SoftOneLiveDiscoveryFailure[];

  fingerprint:
    string;
}


type GenericRecord =
  Record<
    string,
    unknown
  >;


type SoftOneGetObjectsResponse = {
  success?: boolean;
  error?: string;
  errorcode?: number | string;
  count?: number;

  objects?: Array<{
    name: string;
    type?: string;
    caption?: string;
    [key: string]: unknown;
  }>;
};


type SoftOneGetObjectTablesResponse = {
  success?: boolean;
  error?: string;
  errorcode?: number | string;
  count?: number;

  tables?: Array<{
    name: string;
    dbname?: string;
    caption?: string;
    filltype?: string;
    [key: string]: unknown;
  }>;
};


type SoftOneGetTableFieldsResponse = {
  success?: boolean;
  error?: string;
  errorcode?: number | string;
  count?: number;

  fields?: Array<{
    name: string;
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
    links?: unknown[];
    [key: string]: unknown;
  }>;
};




function record(
  value:
    unknown,
): GenericRecord | undefined {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return undefined;
  }


  return value as
    GenericRecord;
}


function text(
  value:
    unknown,
): string | undefined {
  if (
    typeof value ===
      "string" &&
    value.trim()
  ) {
    return value.trim();
  }


  if (
    typeof value ===
      "number"
  ) {
    return String(
      value,
    );
  }


  return undefined;
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
    String(
      value,
    ).toLowerCase() ===
      "true"
  ) {
    return true;
  }


  if (
    value === 0 ||
    value === "0" ||
    String(
      value,
    ).toLowerCase() ===
      "false"
  ) {
    return false;
  }


  return undefined;
}


function firstText(
  source:
    GenericRecord,

  names:
    string[],
): string | undefined {
  for (
    const name
    of names
  ) {
    const direct =
      text(
        source[name],
      );


    if (
      direct
    ) {
      return direct;
    }


    const key =
      Object.keys(
        source,
      ).find(
        candidate =>
          candidate.toLowerCase() ===
          name.toLowerCase(),
      );


    if (
      key
    ) {
      const candidate =
        text(
          source[key],
        );


      if (
        candidate
      ) {
        return candidate;
      }
    }
  }


  return undefined;
}


function canonical(
  value:
    string,
): string {
  return value
    .trim()
    .toUpperCase();
}


function errorMessage(
  error:
    unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(
        error,
      );
}


function assertSuccess(
  response:
    unknown,

  operation:
    string,
): void {
  const obj =
    record(
      response,
    );


  if (
    !obj
  ) {
    return;
  }


  if (
    obj.success ===
      false
  ) {
    throw new Error(
      `${operation}: ${String(
        obj.error ??
        obj.errorcode ??
        "SoftOne returned success=false",
      )}`,
    );
  }
}


async function getObjects(
  connectionId:
    string,
): Promise<GenericRecord[]> {
  const response =
    await callSoftOneAuthenticated<
      SoftOneGetObjectsResponse
    >(
      connectionId,
      {
        service:
          "getObjects",
      },
    );


  assertSuccess(
    response,
    "getObjects",
  );


  if (
    !Array.isArray(
      response.objects,
    )
  ) {
    throw new Error(
      "getObjects returned no objects array",
    );
  }


  return response.objects;
}


async function getObjectTables(
  connectionId:
    string,

  objectName:
    string,
): Promise<GenericRecord[]> {
  const response =
    await callSoftOneAuthenticated<
      SoftOneGetObjectTablesResponse
    >(
      connectionId,
      {
        service:
          "getObjectTables",

        OBJECT:
          objectName,
      },
    );


  assertSuccess(
    response,
    `getObjectTables(${objectName})`,
  );


  if (
    !Array.isArray(
      response.tables,
    )
  ) {
    throw new Error(
      `getObjectTables(${objectName}) returned no tables array`,
    );
  }


  return response.tables;
}


async function getTableFields(
  connectionId:
    string,

  objectName:
    string,

  tableName:
    string,
): Promise<{
  fields:
    GenericRecord[];

  reportedCount:
    number;

  returnedCount:
    number;

  complete:
    boolean;
}> {
  const response =
    await callSoftOneAuthenticated<
      SoftOneGetTableFieldsResponse
    >(
      connectionId,
      {
        service:
          "getTableFields",

        OBJECT:
          objectName,

        TABLE:
          tableName,
      },
    );


  assertSuccess(
    response,
    `getTableFields(${objectName},${tableName})`,
  );


  if (
    !Array.isArray(
      response.fields,
    )
  ) {
    throw new Error(
      `getTableFields(${objectName},${tableName}) returned no fields array`,
    );
  }


  const returnedCount =
    response.fields.length;


  const numericReportedCount =
    Number(
      response.count,
    );


  const reportedCount =
    Number.isFinite(
      numericReportedCount,
    )
      ? numericReportedCount
      : returnedCount;


  return {
    fields:
      response.fields,

    reportedCount,

    returnedCount,

    /*
     * The returned field set is authoritative for the
     * current authenticated SoftOne context.
     *
     * Do not infer missing pagination merely because
     * response.count differs from fields.length.
     */
    complete:
      true,
  };
}


function normalizedObject(
  row:
    GenericRecord,
): {
  name: string;

  caption?: string;

  type?: string;
} | undefined {
  const name =
    firstText(
      row,
      [
        "name",
        "object",
        "objectname",
        "code",
      ],
    );


  if (
    !name
  ) {
    return undefined;
  }


  return {
    name:
      canonical(
        name,
      ),

    caption:
      firstText(
        row,
        [
          "caption",
          "title",
          "descr",
          "description",
        ],
      ),

    type:
      firstText(
        row,
        [
          "type",
          "objecttype",
        ],
      ),
  };
}


function normalizedTable(
  row:
    GenericRecord,
): {
  name: string;

  physicalName?: string;

  caption?: string;
} | undefined {
  const name =
    firstText(
      row,
      [
        "name",
        "table",
        "tablename",
      ],
    );


  if (
    !name
  ) {
    return undefined;
  }


  const physicalName =
    firstText(
      row,
      [
        "dbname",
      ],
    );


  return {
    name:
      canonical(
        name,
      ),

    physicalName:
      physicalName
        ? canonical(
            physicalName,
          )
        : undefined,

    caption:
      firstText(
        row,
        [
          "caption",
          "title",
          "descr",
          "description",
        ],
      ),
  };
}


function normalizedField(
  row:
    GenericRecord,
): SoftOneLiveField | undefined {
  const name =
    firstText(
      row,
      [
        "name",
      ],
    );


  if (
    !name
  ) {
    return undefined;
  }


  return {
    name:
      canonical(
        name,
      ),

    alias:
      text(
        row.alias,
      ),

    fullname:
      text(
        row.fullname,
      ),

    caption:
      text(
        row.caption,
      ),

    size:
      text(
        row.size,
      ),

    type:
      text(
        row.type,
      ),

    editType:
      text(
        row.edittype,
      ),

    xType:
      text(
        row.xtype,
      ),

    defaultValue:
      text(
        row.defaultvalue,
      ),

    decimals:
      text(
        row.decimals,
      ),

    editor:
      text(
        row.editor,
      ),

    readOnly:
      bool(
        row.readOnly,
      ),

    visible:
      bool(
        row.visible,
      ),

    required:
      bool(
        row.required,
      ),

    calculated:
      bool(
        row.calculated,
      ),

    links:
      Array.isArray(
        row.links,
      )
        ? row.links
        : undefined,

    raw:
      row,
  };
}


function snapshotFingerprint(
  objects:
    Record<
      string,
      SoftOneLiveObject
    >,
): string {
  const deterministic =
    Object.keys(
      objects,
    )
      .sort()
      .map(
        objectName => ({
          object:
            objectName,

          tables:
            Object.keys(
              objects[
                objectName
              ].tables,
            )
              .sort()
              .map(
                tableName => ({
                  table:
                    tableName,

                  physicalName:
                    objects[
                      objectName
                    ].tables[
                      tableName
                    ].physicalName,

                  fields:
                    Object.keys(
                      objects[
                        objectName
                      ].tables[
                        tableName
                      ].fields,
                    ).sort(),
                }),
              ),
        }),
      );


  return createHash(
    "sha256",
  )
    .update(
      JSON.stringify(
        deterministic,
      ),
    )
    .digest(
      "hex",
    );
}



export async function discoverSoftOneLiveMetadata(
  input: {
    connectionId:
      string;

    outputPath?:
      string;

    continueOnError?:
      boolean;

    objectFilter?:
      string[];
  },
): Promise<
  SoftOneLiveMetadataSnapshot
> {
  console.error(
    `[SoftOne discovery] START connectionId=${input.connectionId}`,
  );


  console.error(
    "[SoftOne discovery] Loading connection...",
  );


  const connection =
    await getSoftOneConnection(
      input.connectionId,
    );


  console.error(
    `[SoftOne discovery] Connection=${connection.name} company=${connection.company}`,
  );


  const failures:
    SoftOneLiveDiscoveryFailure[] =
    [];


  const objects:
    Record<
      string,
      SoftOneLiveObject
    > =
    {};


  console.error(
    "[SoftOne discovery] Loading getObjects...",
  );


  let objectRows:
    GenericRecord[];


  try {
    objectRows =
      await getObjects(
        input.connectionId,
      );
  }
  catch (
    error
  ) {
    throw new Error(
      `SoftOne live metadata discovery failed at getObjects: ${errorMessage(
        error,
      )}`,
    );
  }


  console.error(
    `[SoftOne discovery] getObjects returned ${objectRows.length} objects`,
  );


  const wanted =
    input.objectFilter?.length
      ? new Set(
          input.objectFilter.map(
            value =>
              canonical(
                value,
              ),
          ),
        )
      : undefined;


  const selectedObjects =
    objectRows
      .map(
        raw => ({
          raw,
          object:
            normalizedObject(
              raw,
            ),
        }),
      )
      .filter(
        item =>
          !!item.object,
      )
      .filter(
        item =>
          !wanted ||
          wanted.has(
            item.object!.name,
          ),
      );


  console.error(
    `[SoftOne discovery] Objects selected: ${selectedObjects.length}`,
  );


  if (
    wanted &&
    selectedObjects.length !==
      wanted.size
  ) {
    const found =
      new Set(
        selectedObjects.map(
          item =>
            item.object!.name,
        ),
      );


    const missing =
      [
        ...wanted,
      ].filter(
        name =>
          !found.has(
            name,
          ),
      );


    if (
      missing.length
    ) {
      console.error(
        `[SoftOne discovery] WARNING missing objects: ${missing.join(", ")}`,
      );
    }
  }


  for (
    const [
      objectIndex,
      item,
    ]
    of selectedObjects.entries()
  ) {
    const object =
      item.object!;


    console.error(
      `[SoftOne discovery] [${objectIndex + 1}/${selectedObjects.length}] ${object.name}: getObjectTables...`,
    );


    const liveObject:
      SoftOneLiveObject = {
        ...object,

        tables:
          {},

        raw:
          item.raw,
      };


    objects[
      object.name
    ] =
      liveObject;


    let tableRows:
      GenericRecord[];


    try {
      tableRows =
        await getObjectTables(
          input.connectionId,
          object.name,
        );
    }
    catch (
      error
    ) {
      failures.push({
        stage:
          "GET_OBJECT_TABLES",

        object:
          object.name,

        error:
          errorMessage(
            error,
          ),
      });


      console.error(
        `[SoftOne discovery] FAIL ${object.name} getObjectTables: ${errorMessage(
          error,
        )}`,
      );


      if (
        input.continueOnError ===
          false
      ) {
        throw error;
      }


      continue;
    }


    console.error(
      `[SoftOne discovery] ${object.name}: tables=${tableRows.length}`,
    );


    for (
      const [
        tableIndex,
        rawTable,
      ]
      of tableRows.entries()
    ) {
      const table =
        normalizedTable(
          rawTable,
        );


      if (
        !table
      ) {
        continue;
      }


      const liveTable:
        SoftOneLiveTable = {
          ...table,

          fields:
            {},

          raw:
            rawTable,
        };


      liveObject.tables[
        table.name
      ] =
        liveTable;


      const fillType =
        String(
          rawTable.filltype ??
          "",
        ).toUpperCase();


      const dbName =
        String(
          rawTable.dbname ??
          "",
        ).trim();


      /*
       * Buffer/non-physical tables are still preserved,
       * but we do not request physical schema fields.
       */
      if (
        fillType !== "SQL" ||
        !dbName
      ) {
        console.error(
          `[SoftOne discovery] ${object.name} [${tableIndex + 1}/${tableRows.length}] ${table.name}: skip filltype=${fillType || "-"} dbname=${dbName || "-"}`,
        );

        continue;
      }


      console.error(
        `[SoftOne discovery] ${object.name} [${tableIndex + 1}/${tableRows.length}] ${table.name} -> ${dbName}: getTableFields...`,
      );


      let fieldResult: {
        fields:
          GenericRecord[];

        reportedCount:
          number;

        returnedCount:
          number;

        complete:
          boolean;
      };


      try {
        fieldResult =
          await getTableFields(
            input.connectionId,
            object.name,
            table.name,
          );
      }
      catch (
        error
      ) {
        failures.push({
          stage:
            "GET_TABLE_FIELDS",

          object:
            object.name,

          table:
            table.name,

          error:
            errorMessage(
              error,
            ),
        });


        console.error(
          `[SoftOne discovery] FAIL ${object.name}.${table.name}: ${errorMessage(
            error,
          )}`,
        );


        if (
          input.continueOnError ===
            false
        ) {
          throw error;
        }


        continue;
      }


      liveTable.reportedFieldCount =
        fieldResult.reportedCount;


      liveTable.returnedFieldCount =
        fieldResult.returnedCount;


      liveTable.visibilityScope =
        "AUTHENTICATED_CONTEXT";


      liveTable.visibilityScope =
        "AUTHENTICATED_CONTEXT";


      liveTable.fieldMetadataComplete =
        fieldResult.complete;


      for (
        const rawField
        of fieldResult.fields
      ) {
        const field =
          normalizedField(
            rawField,
          );


        if (
          !field
        ) {
          continue;
        }


        liveTable.fields[
          field.name
        ] =
          field;
      }


      console.error(
        `[SoftOne discovery] ${object.name}.${table.name}: returned=${fieldResult.returnedCount} reported=${fieldResult.reportedCount} complete=${fieldResult.complete}`,
      );
    }


    const objectFieldCount =
      Object.values(
        liveObject.tables,
      ).reduce(
        (
          total,
          table,
        ) =>
          total +
          Object.keys(
            table.fields,
          ).length,
        0,
      );


    console.error(
      `[SoftOne discovery] DONE ${object.name}: tables=${Object.keys(
        liveObject.tables,
      ).length} fields=${objectFieldCount}`,
    );
  }


  const statistics = {
    objects:
      Object.keys(
        objects,
      ).length,

    tables:
      Object.values(
        objects,
      ).reduce(
        (
          total,
          object,
        ) =>
          total +
          Object.keys(
            object.tables,
          ).length,
        0,
      ),

    fields:
      Object.values(
        objects,
      ).reduce(
        (
          total,
          object,
        ) =>
          total +
          Object.values(
            object.tables,
          ).reduce(
            (
              subtotal,
              table,
            ) =>
              subtotal +
              Object.keys(
                table.fields,
              ).length,
            0,
          ),
        0,
      ),

    failures:
      failures.length,
  };


  const retrievedAt =
    new Date()
      .toISOString();


  const snapshot:
    SoftOneLiveMetadataSnapshot = {
      schemaVersion:
        1,

      source: {
        type:
          "LIVE_WEB_SERVICE_DISCOVERY",

        verification:
          "TENANT_VERIFIED",

        scope:
          "TENANT",

        tenantId:
          connection.tenantId,

        connectionId:
          connection.id,

        connectionName:
          connection.name,

        environment:
          connection.environment,

        company:
          connection.company,

        branch:
          connection.branch,

        module:
          connection.module,

        retrievedAt,
      },

      statistics,

      objects,

      failures,

      fingerprint:
        snapshotFingerprint(
          objects,
        ),
    };


  if (
    input.outputPath
  ) {
    const outputPath =
      resolve(
        process.cwd(),
        input.outputPath,
      );


    await mkdir(
      dirname(
        outputPath,
      ),
      {
        recursive:
          true,
      },
    );


    await writeFile(
      outputPath,
      JSON.stringify(
        snapshot,
        null,
        2,
      ) +
        "\n",
      "utf8",
    );
  }


  console.error(
    `[SoftOne discovery] COMPLETE objects=${statistics.objects} tables=${statistics.tables} fields=${statistics.fields} failures=${statistics.failures}`,
  );


  return snapshot;
}


export function findLiveSoftOneObject(
  snapshot:
    SoftOneLiveMetadataSnapshot,

  objectName:
    string,
): SoftOneLiveObject | undefined {
  return snapshot.objects[
    canonical(
      objectName,
    )
  ];
}


export function findLiveSoftOneTable(
  snapshot:
    SoftOneLiveMetadataSnapshot,

  objectName:
    string,

  tableName:
    string,
): SoftOneLiveTable | undefined {
  return findLiveSoftOneObject(
    snapshot,
    objectName,
  )?.tables[
    canonical(
      tableName,
    )
  ];
}


export function findLiveSoftOneField(
  snapshot:
    SoftOneLiveMetadataSnapshot,

  objectName:
    string,

  tableName:
    string,

  fieldName:
    string,
): SoftOneLiveField | undefined {
  return findLiveSoftOneTable(
    snapshot,
    objectName,
    tableName,
  )?.fields[
    canonical(
      fieldName,
    )
  ];
}
