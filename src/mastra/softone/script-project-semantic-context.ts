import type {
  SoftOneProjectScriptAnalysis,
} from "./script-project-analyzer";

import type {
  SoftOneProjectLinkGraph,
} from "./script-project-linker";

import type {
  SoftOneProjectFieldIndex,
} from "./script-project-field-index";

import {
  findSoftOneFieldSemantic,
  type SoftOneFieldSemanticStatus,
} from "./field-semantics-registry";


export interface SoftOneProjectCurrentContext {
  receiver: string;

  canonical: string;

  files: string[];

  functions: string[];

  fields: string[];

  activeFunctions: string[];

  observedAsTable: boolean;

  observedAsExplicitObject: boolean;

  status:
    | "DETECTED"
    | "AMBIGUOUS";
}


export interface SoftOneProjectObjectTableLink {
  object: string;

  objectCanonical: string;

  table: string;

  tableCanonical: string;

  file: string;

  functionName?: string;

  sourceIndex?: number;

  active: boolean;

  relation:
    "RUNTIME_FINDTABLE_USAGE";
}


export interface SoftOneProjectFieldSemanticResolution {
  canonical: string;

  objectContext?: string;

  meaning?: string;

  semanticStatus?:
    SoftOneFieldSemanticStatus;

  semanticRole?: string;

  references?: {
    object?: string;
    table?: string;
  };

  evidence: string[];

  resolution:
    | "KNOWN"
    | "UNRESOLVED";
}


export interface SoftOneProjectSemanticContext {
  currentContexts:
    SoftOneProjectCurrentContext[];

  objectTableLinks:
    SoftOneProjectObjectTableLink[];

  fieldSemantics:
    SoftOneProjectFieldSemanticResolution[];

  unresolvedFields:
    string[];
}


function functionId(
  file: string,
  functionName?: string,
): string | undefined {
  if (
    !functionName
  ) {
    return undefined;
  }

  return `${file}::${functionName}`;
}


export function buildSoftOneProjectSemanticContext(
  files:
    SoftOneProjectScriptAnalysis[],

  linkGraph:
    SoftOneProjectLinkGraph,

  fieldIndex:
    SoftOneProjectFieldIndex,
): SoftOneProjectSemanticContext {
  const reachable =
    new Set(
      linkGraph.projectReachableFunctions,
    );


  /*
   * A current-context receiver is discovered from executable
   * implicit field access:
   *
   *   SOMETHING.FIELD
   *
   * No business meaning is assigned here.
   */
  const contextMap =
    new Map<
      string,
      {
        files: Set<string>;
        functions: Set<string>;
        fields: Set<string>;
        activeFunctions: Set<string>;
      }
    >();


  for (
    const file
    of files
  ) {
    for (
      const access
      of file.structure
        .implicitFieldAccesses
    ) {
      const receiver =
        access.receiver
          .trim()
          .toUpperCase();

      const current =
        contextMap.get(
          receiver,
        ) ?? {
          files:
            new Set<string>(),

          functions:
            new Set<string>(),

          fields:
            new Set<string>(),

          activeFunctions:
            new Set<string>(),
        };


      current.files.add(
        file.file,
      );

      current.fields.add(
        access.canonical,
      );


      if (
        access.functionName
      ) {
        const id =
          functionId(
            file.file,
            access.functionName,
          );

        current.functions.add(
          id ??
          `${file.file}::${access.functionName}`,
        );


        if (
          id &&
          reachable.has(
            id,
          )
        ) {
          current.activeFunctions.add(
            id,
          );
        }
      }


      contextMap.set(
        receiver,
        current,
      );
    }
  }


  const explicitObjects =
    new Set(
      files.flatMap(
        file =>
          file.decoded.objectUsages.map(
            usage =>
              usage.object
                .trim()
                .toUpperCase(),
          ),
      ),
    );


  const observedTables =
    new Set(
      files.flatMap(
        file =>
          file.decoded.tables.map(
            table =>
              table
                .trim()
                .toUpperCase(),
          ),
      ),
    );


  const currentContexts:
    SoftOneProjectCurrentContext[] =
    [
      ...contextMap.entries(),
    ]
      .map(
        (
          [
            receiver,
            context,
          ],
        ) : SoftOneProjectCurrentContext => ({
          receiver,

          canonical:
            `CONTEXT:${receiver}`,

          files:
            [
              ...context.files,
            ].sort(),

          functions:
            [
              ...context.functions,
            ].sort(),

          fields:
            [
              ...context.fields,
            ].sort(),

          activeFunctions:
            [
              ...context.activeFunctions,
            ].sort(),

          observedAsTable:
            observedTables.has(
              receiver,
            ),

          observedAsExplicitObject:
            explicitObjects.has(
              receiver,
            ),

          /*
           * Receiver detection itself is deterministic.
           * "AMBIGUOUS" only means we do not have enough structural
           * evidence to equate it with an explicit runtime object.
           */
          status:
            explicitObjects.has(
              receiver,
            )
              ? "DETECTED"
              : "AMBIGUOUS",
        }),
      )
      .sort(
        (
          a,
          b,
        ) =>
          a.receiver.localeCompare(
            b.receiver,
          ),
      );


  /*
   * These links mean only:
   *
   *   object.FINDTABLE("TABLE")
   *
   * was observed in source.
   *
   * They are NOT promoted to global physical object/table mappings.
   */
  const objectTableLinks:
    SoftOneProjectObjectTableLink[] =
    [];


  for (
    const file
    of files
  ) {
    for (
      const usage
      of file.decoded
        .objectUsages
    ) {
      const id =
        functionId(
          file.file,
          usage.functionName,
        );


      for (
        const table
        of usage.tables
      ) {
        objectTableLinks.push({
          object:
            usage.object,

          objectCanonical:
            `OBJECT:${usage.object.toUpperCase()}`,

          table,

          tableCanonical:
            `TABLE:${table.toUpperCase()}`,

          file:
            file.file,

          functionName:
            usage.functionName,

          sourceIndex:
            usage.sourceIndex,

          active:
            id
              ? reachable.has(
                  id,
                )
              : false,

          relation:
            "RUNTIME_FINDTABLE_USAGE",
        });
      }
    }
  }


  /*
   * Map field usage to its runtime object context when the field
   * originates from a dataset owned by an explicit SoftOne object.
   *
   * Example:
   *
   *   salObj = X.CREATEOBJFORM("SALDOC")
   *   FinTbl = salObj.FINDTABLE("FINDOC")
   *   FinTbl.TRDR = ...
   *
   * gives:
   *
   *   FIELD:FINDOC.TRDR
   *   objectContext = SALDOC
   *
   * This is observed source structure only; no global object/table
   * mapping is inferred here.
   */
  const fieldObjectContexts =
    new Map<
      string,
      Set<string>
    >();


  for (
    const file
    of files
  ) {
    for (
      const field
      of file.decoded.fieldUsages
    ) {
      const object =
        field.object
          ?.trim()
          .toUpperCase();

      if (
        !object
      ) {
        continue;
      }


      const contexts =
        fieldObjectContexts.get(
          field.canonical,
        ) ??
        new Set<string>();


      contexts.add(
        object,
      );


      fieldObjectContexts.set(
        field.canonical,
        contexts,
      );
    }
  }


  const fieldSemantics:
    SoftOneProjectFieldSemanticResolution[] =
    [];


  for (
    const field
    of fieldIndex.fields
  ) {
    const contexts =
      [
        ...(
          fieldObjectContexts.get(
            field.canonical,
          ) ??
          []
        ),
      ];


    /*
     * No explicit object context:
     * only globally-safe semantics may resolve.
     */
    if (
      contexts.length === 0
    ) {
      const semantic =
        findSoftOneFieldSemantic(
          field.canonical,
        );


      if (
        !semantic
      ) {
        fieldSemantics.push({
          canonical:
            field.canonical,

          evidence:
            [],

          resolution:
            "UNRESOLVED",
        });

        continue;
      }


      fieldSemantics.push({
        canonical:
          field.canonical,

        meaning:
          semantic.meaning,

        semanticStatus:
          semantic.status,

        semanticRole:
          semantic.semanticRole,

        references:
          semantic.references,

        evidence:
          semantic.evidence,

        resolution:
          "KNOWN",
      });

      continue;
    }


    /*
     * Resolve once per observed object context.
     *
     * The same physical field may legitimately have different
     * semantics depending on the SoftOne object using the dataset.
     */
    for (
      const objectContext
      of contexts.sort()
    ) {
      const semantic =
        findSoftOneFieldSemantic(
          field.canonical,
          objectContext,
        );


      if (
        !semantic
      ) {
        fieldSemantics.push({
          canonical:
            field.canonical,

          objectContext,

          evidence:
            [],

          resolution:
            "UNRESOLVED",
        });

        continue;
      }


      fieldSemantics.push({
        canonical:
          field.canonical,

        objectContext,

        meaning:
          semantic.meaning,

        semanticStatus:
          semantic.status,

        semanticRole:
          semantic.semanticRole,

        references:
          semantic.references,

        evidence:
          semantic.evidence,

        resolution:
          "KNOWN",
      });
    }
  }


  return {
    currentContexts,

    objectTableLinks,

    fieldSemantics,

    unresolvedFields:
      [
        ...new Set(
          fieldSemantics
            .filter(
              field =>
                field.resolution ===
                  "UNRESOLVED",
            )
            .map(
              field =>
                field.objectContext
                  ? `${field.canonical}@OBJECT:${field.objectContext}`
                  : field.canonical,
            ),
        ),
      ].sort(),
  };
}
