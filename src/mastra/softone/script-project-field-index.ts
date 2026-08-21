import type {
  SoftOneProjectScriptAnalysis,
} from "./script-project-analyzer";

import type {
  SoftOneProjectLinkGraph,
} from "./script-project-linker";


export interface SoftOneProjectFieldAccessRef {
  file: string;

  functionName?: string;

  access:
    | "READ"
    | "WRITE";

  expression?: string;

  sourceIndex?: number;

  projectReachable:
    boolean;

  source:
    | "IMPLICIT_SCRIPT_CONTEXT"
    | "OBJECT_DATASET";
}


export interface SoftOneProjectFieldNode {
  canonical: string;

  accesses:
    SoftOneProjectFieldAccessRef[];

  files:
    string[];

  readers:
    string[];

  writers:
    string[];

  activeReaders:
    string[];

  activeWriters:
    string[];
}


export interface SoftOneProjectFieldDependency {
  field: string;

  writers:
    string[];

  readers:
    string[];

  active:
    boolean;
}


export interface SoftOneProjectFieldIndex {
  fields:
    SoftOneProjectFieldNode[];

  dependencies:
    SoftOneProjectFieldDependency[];
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


export function buildSoftOneProjectFieldIndex(
  files:
    SoftOneProjectScriptAnalysis[],

  linkGraph:
    SoftOneProjectLinkGraph,
): SoftOneProjectFieldIndex {
  const reachable =
    new Set(
      linkGraph
        .projectReachableFunctions,
    );


  const index =
    new Map<
      string,
      SoftOneProjectFieldAccessRef[]
    >();


  function add(
    canonical: string,
    access:
      SoftOneProjectFieldAccessRef,
  ): void {
    const existing =
      index.get(
        canonical,
      ) ??
      [];


    existing.push(
      access,
    );


    index.set(
      canonical,
      existing,
    );
  }


  for (
    const file
    of files
  ) {
    for (
      const access
      of file.structure
        .implicitFieldAccesses
    ) {
      const id =
        functionId(
          file.file,
          access.functionName,
        );


      add(
        access.canonical,
        {
          file:
            file.file,

          functionName:
            access.functionName,

          access:
            access.access,

          expression:
            access.expression,

          sourceIndex:
            access.sourceIndex,

          projectReachable:
            id
              ? reachable.has(
                  id,
                )
              : false,

          source:
            "IMPLICIT_SCRIPT_CONTEXT",
        },
      );
    }


    for (
      const field
      of file.decoded.fieldUsages
    ) {
      const functionName =
        field.valueOrigin
          ?.functionName;

      const id =
        functionId(
          file.file,
          functionName,
        );


      add(
        field.canonical,
        {
          file:
            file.file,

          functionName,

          access:
            field.access,

          expression:
            field.expression,

          projectReachable:
            id
              ? reachable.has(
                  id,
                )
              : false,

          source:
            "OBJECT_DATASET",
        },
      );
    }
  }


  const fields:
    SoftOneProjectFieldNode[] =
      [
        ...index.entries(),
      ]
        .map(
          (
            [
              canonical,
              accesses,
            ],
          ) => {
            const readers =
              new Set<string>();

            const writers =
              new Set<string>();

            const activeReaders =
              new Set<string>();

            const activeWriters =
              new Set<string>();


            for (
              const access
              of accesses
            ) {
              const id =
                functionId(
                  access.file,
                  access.functionName,
                );


              if (
                !id
              ) {
                continue;
              }


              if (
                access.access ===
                  "READ"
              ) {
                readers.add(
                  id,
                );


                if (
                  access.projectReachable
                ) {
                  activeReaders.add(
                    id,
                  );
                }
              }
              else {
                writers.add(
                  id,
                );


                if (
                  access.projectReachable
                ) {
                  activeWriters.add(
                    id,
                  );
                }
              }
            }


            return {
              canonical,

              accesses,

              files:
                [
                  ...new Set(
                    accesses.map(
                      access =>
                        access.file,
                    ),
                  ),
                ].sort(),

              readers:
                [
                  ...readers,
                ].sort(),

              writers:
                [
                  ...writers,
                ].sort(),

              activeReaders:
                [
                  ...activeReaders,
                ].sort(),

              activeWriters:
                [
                  ...activeWriters,
                ].sort(),
            };
          },
        )
        .sort(
          (
            a,
            b,
          ) =>
            a.canonical.localeCompare(
              b.canonical,
            ),
        );


  const dependencies:
    SoftOneProjectFieldDependency[] =
      fields
        .filter(
          field =>
            field.writers.length >
              0 &&
            field.readers.length >
              0,
        )
        .map(
          field => ({
            field:
              field.canonical,

            writers:
              field.writers,

            readers:
              field.readers,

            active:
              field.activeWriters.length >
                0 &&
              field.activeReaders.length >
                0,
          }),
        );


  return {
    fields,

    dependencies,
  };
}
