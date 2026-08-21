import type {
  SoftOneProjectScriptAnalysis,
} from "./script-project-analyzer";


export type SoftOneProjectCallResolution =
  | "LOCAL"
  | "CROSS_FILE"
  | "AMBIGUOUS"
  | "UNRESOLVED";


export interface SoftOneProjectFunctionNode {
  id: string;

  file: string;

  name: string;

  eventHandler: boolean;

  localReachableFromEvent: boolean;

  projectReachableFromEvent: boolean;
}


export interface SoftOneProjectCallEdge {
  from: string;

  call: string;

  resolution:
    SoftOneProjectCallResolution;

  targets: string[];
}


export interface SoftOneProjectSymbol {
  name: string;

  definitions: string[];

  ambiguous: boolean;
}


export interface SoftOneProjectIncludeEdge {
  fromFile: string;

  library: string;

  resolvedFiles: string[];

  resolved: boolean;
}


export interface SoftOneProjectLinkGraph {
  functions:
    SoftOneProjectFunctionNode[];

  symbols:
    SoftOneProjectSymbol[];

  callEdges:
    SoftOneProjectCallEdge[];

  includeEdges:
    SoftOneProjectIncludeEdge[];

  entryPoints: string[];

  projectReachableFunctions:
    string[];

  projectUnreachableFunctions:
    string[];

  unresolvedCalls:
    SoftOneProjectCallEdge[];

  ambiguousCalls:
    SoftOneProjectCallEdge[];
}


function functionId(
  file: string,
  name: string,
): string {
  return `${file}::${name}`;
}


export function linkSoftOneScriptProject(
  files:
    SoftOneProjectScriptAnalysis[],

  includes?: Array<{
    file: string;
    library: string;
    resolvedFiles: string[];
    resolved: boolean;
  }>,
): SoftOneProjectLinkGraph {
  const nodes:
    SoftOneProjectFunctionNode[] =
      files.flatMap(
        file =>
          file.structure.functions.map(
            fn => ({
              id:
                functionId(
                  file.file,
                  fn.name,
                ),

              file:
                file.file,

              name:
                fn.name,

              eventHandler:
                fn.eventHandler,

              localReachableFromEvent:
                fn.reachableFromEvents,

              projectReachableFromEvent:
                false,
            }),
          ),
      );


  const definitionsByName =
    new Map<
      string,
      SoftOneProjectFunctionNode[]
    >();


  for (
    const node
    of nodes
  ) {
    const definitions =
      definitionsByName.get(
        node.name,
      ) ??
      [];


    definitions.push(
      node,
    );


    definitionsByName.set(
      node.name,
      definitions,
    );
  }


  const symbols:
    SoftOneProjectSymbol[] =
      [
        ...definitionsByName.entries(),
      ]
        .map(
          (
            [
              name,
              definitions,
            ],
          ) => ({
            name,

            definitions:
              definitions.map(
                definition =>
                  definition.id,
              ),

            ambiguous:
              definitions.length >
              1,
          }),
        )
        .sort(
          (
            a,
            b,
          ) =>
            a.name.localeCompare(
              b.name,
            ),
        );


  const callEdges:
    SoftOneProjectCallEdge[] = [];


  for (
    const file
    of files
  ) {
    for (
      const fn
      of file.structure.functions
    ) {
      const from =
        functionId(
          file.file,
          fn.name,
        );


      for (
        const call
        of fn.callIdentifiers
      ) {
        const allDefinitions =
          definitionsByName.get(
            call,
          ) ??
          [];


        /*
         * Prefer a same-file definition.
         *
         * This preserves normal JavaScript lexical expectations
         * and avoids accidentally linking to another file when a
         * local helper with the same name exists.
         */
        const localDefinitions =
          allDefinitions.filter(
            definition =>
              definition.file ===
              file.file,
          );


        if (
          localDefinitions.length ===
          1
        ) {
          callEdges.push({
            from,

            call,

            resolution:
              "LOCAL",

            targets: [
              localDefinitions[0].id,
            ],
          });

          continue;
        }


        if (
          localDefinitions.length >
          1
        ) {
          callEdges.push({
            from,

            call,

            resolution:
              "AMBIGUOUS",

            targets:
              localDefinitions.map(
                definition =>
                  definition.id,
              ),
          });

          continue;
        }


        if (
          allDefinitions.length ===
          1
        ) {
          callEdges.push({
            from,

            call,

            resolution:
              "CROSS_FILE",

            targets: [
              allDefinitions[0].id,
            ],
          });

          continue;
        }


        if (
          allDefinitions.length >
          1
        ) {
          callEdges.push({
            from,

            call,

            resolution:
              "AMBIGUOUS",

            targets:
              allDefinitions.map(
                definition =>
                  definition.id,
              ),
          });

          continue;
        }


        /*
         * Do not emit every ordinary JavaScript/library call as a
         * project warning.
         *
         * Keep unresolved calls only when they look like potential
         * custom project functions.
         *
         * X.*, methods and member calls are not captured by the
         * plain-identifier detector anyway.
         */
        callEdges.push({
          from,

          call,

          resolution:
            "UNRESOLVED",

          targets: [],
        });
      }
    }
  }


  const entryPoints =
    nodes
      .filter(
        node =>
          node.eventHandler,
      )
      .map(
        node =>
          node.id,
      );


  const reachable =
    new Set<string>();


  const queue =
    [
      ...entryPoints,
    ];


  while (
    queue.length >
    0
  ) {
    const current =
      queue.shift();


    if (
      !current ||
      reachable.has(
        current,
      )
    ) {
      continue;
    }


    reachable.add(
      current,
    );


    const outgoing =
      callEdges.filter(
        edge =>
          edge.from ===
            current &&
          (
            edge.resolution ===
              "LOCAL" ||
            edge.resolution ===
              "CROSS_FILE"
          ),
      );


    for (
      const edge
      of outgoing
    ) {
      for (
        const target
        of edge.targets
      ) {
        if (
          !reachable.has(
            target,
          )
        ) {
          queue.push(
            target,
          );
        }
      }
    }
  }


  for (
    const node
    of nodes
  ) {
    node.projectReachableFromEvent =
      reachable.has(
        node.id,
      );
  }


  const includeEdges:
    SoftOneProjectIncludeEdge[] =
      (
        includes ??
        []
      ).map(
        include => ({
          fromFile:
            include.file,

          library:
            include.library,

          resolvedFiles:
            include.resolvedFiles,

          resolved:
            include.resolved,
        }),
      );


  return {
    functions:
      nodes,

    symbols,

    callEdges,

    includeEdges,

    entryPoints,

    projectReachableFunctions:
      [
        ...reachable,
      ],

    projectUnreachableFunctions:
      nodes
        .filter(
          node =>
            !reachable.has(
              node.id,
            ),
        )
        .map(
          node =>
            node.id,
        ),

    unresolvedCalls:
      callEdges.filter(
        edge =>
          edge.resolution ===
            "UNRESOLVED",
      ),

    ambiguousCalls:
      callEdges.filter(
        edge =>
          edge.resolution ===
            "AMBIGUOUS",
      ),
  };
}
