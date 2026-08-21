import {
  callSoftOneAuthenticated,
} from "../tools/softone";

import {
  resolveSoftOneMetadata,
  type SoftOneMetadataResolution,
} from "./targeted-metadata-resolver";


type GenericRecord =
  Record<string, unknown>;


export type SoftOneImplementationIdentifier = {
  object:
    string;

  logicalTable:
    string;

  physicalTable?:
    string;

  field:
    string;

  reference:
    string;

  origin:
    | "DIRECT_REFERENCE"
    | "SQL_ALIAS"
    | "SQL_EXPRESSION";
};


export type SoftOneImplementationMetadataEvidence = {
  identifier:
    SoftOneImplementationIdentifier;

  resolution:
    SoftOneMetadataResolution;
};


export type SoftOneImplementationMetadataBundle = {
  object:
    string;

  identifiers:
    SoftOneImplementationIdentifier[];

  verified:
    SoftOneImplementationMetadataEvidence[];

  unresolved:
    SoftOneImplementationIdentifier[];

  unresolvedSqlTables:
    string[];
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


function uniqueBy<T>(
  values:
    T[],

  key:
    (
      value:
        T,
    ) => string,
): T[] {
  const seen =
    new Set<string>();


  return values.filter(
    value => {
      const candidate =
        key(
          value,
        );


      if (
        seen.has(
          candidate,
        )
      ) {
        return false;
      }


      seen.add(
        candidate,
      );

      return true;
    },
  );
}


export function redactImplementationSecrets(
  source:
    string,
): string {
  return source
    /*
     * JSON/JS credential-like properties.
     */
    .replace(
      /(["']?(?:client_secret|password|passwd|access_token|refresh_token|api[_-]?key|authorization)["']?\s*:\s*)["'][^"']*["']/gi,
      '$1"[REDACTED]"',
    )

    /*
     * Simple assignments.
     */
    .replace(
      /\b((?:client_secret|password|passwd|access_token|refresh_token|api[_-]?key|authorization)\s*=\s*)["'][^"']*["']/gi,
      '$1"[REDACTED]"',
    );
}


async function getObjectTables(
  connectionId:
    string,

  objectName:
    string,
): Promise<
  Array<{
    logicalName:
      string;

    physicalName?:
      string;

    fillType?:
      string;
  }>
> {
  const response =
    await callSoftOneAuthenticated<{
      success?:
        boolean;

      tables?:
        GenericRecord[];
    }>(
      connectionId,
      {
        service:
          "getObjectTables",

        OBJECT:
          canonical(
            objectName,
          ),
      },
    );


  if (
    response.success !==
      true ||
    !Array.isArray(
      response.tables,
    )
  ) {
    throw new Error(
      `SoftOne getObjectTables failed for ${objectName}`,
    );
  }


  const tables: Array<{
    logicalName:
      string;

    physicalName?:
      string;

    fillType?:
      string;
  }> = [];


  for (
    const table
    of response.tables
  ) {
    const logicalName =
      text(
        table.name,
      );


    if (
      !logicalName
    ) {
      continue;
    }


    const physicalName =
      text(
        table.dbname,
      );

    const fillType =
      text(
        table.filltype,
      );


    tables.push({
      logicalName:
        canonical(
          logicalName,
        ),

      ...(physicalName
        ? {
            physicalName,
          }
        : {}),

      ...(fillType
        ? {
            fillType,
          }
        : {}),
    });
  }


  return tables;
}


function extractSqlAliases(
  source:
    string,
): Map<
  string,
  string
> {
  const aliases =
    new Map<
      string,
      string
    >();


  /*
   * FROM MTRDOC md
   * JOIN COUNTRY c
   * FROM MTRDOC AS md
   */
  const regex =
    /\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_$]*)\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_$]*)\b/gi;


  for (
    const match
    of source.matchAll(
      regex,
    )
  ) {
    const table =
      match[1];

    const alias =
      match[2];


    if (
      !table ||
      !alias
    ) {
      continue;
    }


    /*
     * Avoid treating SQL keywords as aliases.
     */
    if (
      [
        "WHERE",
        "INNER",
        "LEFT",
        "RIGHT",
        "FULL",
        "JOIN",
        "ON",
        "GROUP",
        "ORDER",
        "SET",
      ].includes(
        canonical(
          alias,
        ),
      )
    ) {
      continue;
    }


    aliases.set(
      canonical(
        alias,
      ),
      canonical(
        table,
      ),
    );
  }


  return aliases;
}


function extractSqlTables(
  source:
    string,
): string[] {
  const values:
    string[] =
    [];


  const regex =
    /\b(?:FROM|JOIN|UPDATE|INTO)\s+([A-Za-z_][A-Za-z0-9_$]*)\b/gi;


  for (
    const match
    of source.matchAll(
      regex,
    )
  ) {
    if (
      match[1]
    ) {
      values.push(
        canonical(
          match[1],
        ),
      );
    }
  }


  return [
    ...new Set(
      values,
    ),
  ];
}


export async function enrichSoftOneImplementationMetadata(
  input: {
    connectionId:
      string;

    object:
      string;

    sourceCode:
      string;
  },
): Promise<
  SoftOneImplementationMetadataBundle
> {
  const object =
    canonical(
      input.object,
    );


  /*
   * Only one getObjectTables call.
   *
   * This gives us the legal logical/physical table vocabulary
   * for the authenticated SoftOne object context.
   */
  const objectTables =
    await getObjectTables(
      input.connectionId,
      object,
    );


  const tableByLogical =
    new Map(
      objectTables.map(
        table => [
          canonical(
            table.logicalName,
          ),
          table,
        ],
      ),
    );


  const tableByPhysical =
    new Map(
      objectTables
        .filter(
          table =>
            !!table.physicalName,
        )
        .map(
          table => [
            canonical(
              table.physicalName!,
            ),
            table,
          ],
        ),
    );


  const sqlAliases =
    extractSqlAliases(
      input.sourceCode,
    );


  const sqlTables =
    extractSqlTables(
      input.sourceCode,
    );


  const identifiers:
    SoftOneImplementationIdentifier[] =
    [];


  /*
   * Capture:
   *
   * FINDOC.FIELD
   * MTRDOC.FIELD
   * md.FIELD -> MTRDOC.FIELD
   * c.FIELD  -> COUNTRY.FIELD
   *
   * while rejecting application variables such as:
   *
   * countryData.NAME
   * postReq.result
   * param.data
   */
  const dottedRegex =
    /\b([A-Za-z_][A-Za-z0-9_$]*)\.([A-Za-z_][A-Za-z0-9_$]*)\b/g;


  for (
    const match
    of input.sourceCode.matchAll(
      dottedRegex,
    )
  ) {
    const left =
      match[1];

    const field =
      match[2];


    if (
      !left ||
      !field
    ) {
      continue;
    }


    const leftCanonical =
      canonical(
        left,
      );


    let table =
      tableByLogical.get(
        leftCanonical,
      );


    let origin:
      SoftOneImplementationIdentifier["origin"] =
        "DIRECT_REFERENCE";


    if (
      !table
    ) {
      table =
        tableByPhysical.get(
          leftCanonical,
        );
    }


    if (
      !table
    ) {
      const aliasTable =
        sqlAliases.get(
          leftCanonical,
        );


      if (
        aliasTable
      ) {
        table =
          tableByLogical.get(
            aliasTable,
          ) ??
          tableByPhysical.get(
            aliasTable,
          );

        origin =
          "SQL_ALIAS";
      }
    }


    if (
      !table
    ) {
      continue;
    }


    identifiers.push({
      object,

      logicalTable:
        table.logicalName,

      physicalTable:
        table.physicalName,

      field,

      reference:
        `${left}.${field}`,

      origin,
    });
  }


  /*
   * Handle common UPDATE ... SET FIELD patterns where fields
   * do not appear as TABLE.FIELD.
   *
   * Example:
   * UPDATE FINDOC
   * SET cccGeneralPostalIsClosed = 1
   */
  const updateRegex =
    /\bUPDATE\s+([A-Za-z_][A-Za-z0-9_$]*)\s+SET\s+([\s\S]*?)(?:\bWHERE\b|$)/gi;


  for (
    const match
    of input.sourceCode.matchAll(
      updateRegex,
    )
  ) {
    const rawTable =
      match[1];

    const setClause =
      match[2];


    if (
      !rawTable ||
      !setClause
    ) {
      continue;
    }


    const table =
      tableByLogical.get(
        canonical(
          rawTable,
        ),
      ) ??
      tableByPhysical.get(
        canonical(
          rawTable,
        ),
      );


    if (
      !table
    ) {
      continue;
    }


    const assignmentRegex =
      /\b([A-Za-z_][A-Za-z0-9_$]*)\s*=/g;


    for (
      const assignment
      of setClause.matchAll(
        assignmentRegex,
      )
    ) {
      const field =
        assignment[1];


      if (
        !field
      ) {
        continue;
      }


      identifiers.push({
        object,

        logicalTable:
          table.logicalName,

        physicalTable:
          table.physicalName,

        field,

        reference:
          `${rawTable}.${field}`,

        origin:
          "SQL_EXPRESSION",
      });
    }
  }


  const dedupedIdentifiers =
    uniqueBy(
      identifiers,
      identifier =>
        [
          identifier.object,
          identifier.logicalTable,
          canonical(
            identifier.field,
          ),
        ].join(
          ":",
        ),
    );


  const verified:
    SoftOneImplementationMetadataEvidence[] =
    [];


  const unresolved:
    SoftOneImplementationIdentifier[] =
    [];


  /*
   * Important:
   *
   * resolveSoftOneMetadata caches a fetched table.
   * Therefore the first field requiring live verification
   * causes one getTableFields request; additional fields
   * from the same table resolve from the context cache.
   */
  for (
    const identifier
    of dedupedIdentifiers
  ) {
    const resolution =
      await resolveSoftOneMetadata({
        connectionId:
          input.connectionId,

        object:
          identifier.object,

        table:
          identifier.logicalTable,

        field:
          identifier.field,

        preferBaseline:
          true,
      });


    if (
      resolution.found
    ) {
      verified.push({
        identifier,
        resolution,
      });
    }
    else {
      unresolved.push(
        identifier,
      );
    }
  }


  const knownObjectTables =
    new Set([
      ...tableByLogical.keys(),
      ...tableByPhysical.keys(),
    ]);


  const unresolvedSqlTables =
    sqlTables.filter(
      table =>
        !knownObjectTables.has(
          table,
        ),
    );


  return {
    object,
    identifiers:
      dedupedIdentifiers,

    verified,
    unresolved,

    unresolvedSqlTables,
  };
}
