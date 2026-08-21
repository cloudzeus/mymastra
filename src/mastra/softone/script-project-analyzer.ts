import {
  readdir,
  readFile,
} from "node:fs/promises";

import {
  extname,
  relative,
  resolve,
} from "node:path";

import {
  decodeSoftOneScript,
  type SoftOneDecodedScript,
} from "./advanced-javascript-decoder";

import {
  analyzeSoftOneScriptStructure,
  type SoftOneScriptStructure,
} from "./script-structure-analyzer";

import {
  synthesizeSoftOneBusinessOperations,
  type SoftOneBusinessOperation,
} from "./business-operation-synthesizer";

import {
  classifySoftOneScriptRisk,
  type SoftOneScriptRiskAssessment,
} from "./script-risk-classifier";

import {
  linkSoftOneScriptProject,
  type SoftOneProjectLinkGraph,
} from "./script-project-linker";

import {
  analyzeSoftOneRuntimeInvocations,
  type SoftOneRuntimeInvocationAnalysis,
} from "./script-runtime-invocation-analyzer";

import {
  buildSoftOneProjectSemanticGraph,
  type SoftOneProjectSemanticGraph,
} from "./script-project-semantic-graph";

import {
  buildSoftOneProjectSemanticContext,
  type SoftOneProjectSemanticContext,
} from "./script-project-semantic-context";

import {
  buildSoftOneProjectFieldIndex,
  type SoftOneProjectFieldIndex,
} from "./script-project-field-index";

import {
  buildSoftOneProjectDataFlowGraph,
  type SoftOneProjectDataFlowGraph,
} from "./script-project-data-flow";

import {
  buildSoftOneProjectArgumentLineage,
  type SoftOneProjectArgumentLineage,
} from "./script-project-argument-lineage";

import {
  analyzeSoftOneProjectExecutionSemantics,
  type SoftOneProjectExecutionSemantics,
} from "./script-project-execution-semantics";

import {
  buildSoftOneProjectValueLineageGraph,
  type SoftOneProjectValueLineageGraph,
} from "./script-project-value-lineage";


const DEFAULT_SCRIPT_EXTENSIONS =
  new Set([
    ".js",
    ".javascript",
    ".txt",
  ]);


const IGNORED_DIRECTORIES =
  new Set([
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
  ]);


export interface SoftOneProjectScriptAnalysis {
  file: string;

  absolutePath: string;

  bytes: number;

  source: string;

  decoded:
    SoftOneDecodedScript;

  structure:
    SoftOneScriptStructure;

  runtimeInvocations:
    SoftOneRuntimeInvocationAnalysis;

  businessOperations:
    SoftOneBusinessOperation[];

  risk:
    SoftOneScriptRiskAssessment;
}


export interface SoftOneProjectFunctionRef {
  id: string;

  file: string;

  name: string;

  parameters: string[];

  eventHandler: boolean;

  locallyReachableFromEvent: boolean;
}


export interface SoftOneProjectIncludeRef {
  file: string;

  library: string;

  resolvedFiles: string[];

  resolved: boolean;
}


export interface SoftOneProjectConstructRef {
  canonical: string;

  files: string[];
}


export interface SoftOneProjectAnalysis {
  root: string;

  fileCount: number;

  files:
    SoftOneProjectScriptAnalysis[];

  functions:
    SoftOneProjectFunctionRef[];

  eventHandlers:
    SoftOneProjectFunctionRef[];

  includes:
    SoftOneProjectIncludeRef[];

  linkGraph:
    SoftOneProjectLinkGraph;

  fieldIndex:
    SoftOneProjectFieldIndex;

  semanticContext:
    SoftOneProjectSemanticContext;

  semanticGraph:
    SoftOneProjectSemanticGraph;

  dataFlow:
    SoftOneProjectDataFlowGraph;

  argumentLineage:
    SoftOneProjectArgumentLineage;

  valueLineage:
    SoftOneProjectValueLineageGraph;

  executionSemantics:
    SoftOneProjectExecutionSemantics;

  constructs:
    SoftOneProjectConstructRef[];

  tables:
    SoftOneProjectConstructRef[];

  objects:
    SoftOneProjectConstructRef[];

  fields:
    SoftOneProjectConstructRef[];

  systemParameters:
    SoftOneProjectConstructRef[];

  summary: {
    businessOperationCount: number;

    directSqlReadCount: number;

    directSqlWriteCount: number;

    filesWithBusinessWrites: number;

    filesWithDirectDatabaseAccess: number;

    filesWithIncludes: number;

    unresolvedIncludeCount: number;

    highestRisk:
      | "LOW"
      | "MEDIUM"
      | "HIGH"
      | "CRITICAL";
  };
}


async function discoverScriptFiles(
  root: string,
): Promise<string[]> {
  const result:
    string[] = [];


  async function walk(
    directory: string,
  ): Promise<void> {
    const entries =
      await readdir(
        directory,
        {
          withFileTypes: true,
        },
      );


    for (
      const entry
      of entries
    ) {
      const fullPath =
        resolve(
          directory,
          entry.name,
        );


      if (
        entry.isDirectory()
      ) {
        if (
          !IGNORED_DIRECTORIES.has(
            entry.name,
          )
        ) {
          await walk(
            fullPath,
          );
        }

        continue;
      }


      if (
        !entry.isFile()
      ) {
        continue;
      }


      const extension =
        extname(
          entry.name,
        ).toLowerCase();


      if (
        DEFAULT_SCRIPT_EXTENSIONS.has(
          extension,
        )
      ) {
        result.push(
          fullPath,
        );
      }
    }
  }


  await walk(
    root,
  );


  return result.sort();
}


function canonicalStem(
  file: string,
): string {
  return file
    .replace(
      /\.[^.]+$/,
      "",
    )
    .replace(
      /\\/g,
      "/",
    )
    .toLowerCase();
}


function buildConstructIndex(
  files:
    SoftOneProjectScriptAnalysis[],
  type?: string,
): SoftOneProjectConstructRef[] {
  const index =
    new Map<
      string,
      Set<string>
    >();


  for (
    const file
    of files
  ) {
    for (
      const construct
      of file.decoded.constructs
    ) {
      if (
        type &&
        construct.type !==
          type
      ) {
        continue;
      }


      const canonical =
        construct.canonical;


      if (
        !canonical
      ) {
        continue;
      }


      const owners =
        index.get(
          canonical,
        ) ??
        new Set<string>();


      owners.add(
        file.file,
      );


      index.set(
        canonical,
        owners,
      );
    }
  }


  return [
    ...index.entries(),
  ]
    .map(
      (
        [
          canonical,
          owners,
        ],
      ) => ({
        canonical,

        files:
          [
            ...owners,
          ].sort(),
      }),
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
}


function riskRank(
  risk:
    SoftOneScriptRiskAssessment["riskLevel"],
): number {
  switch (
    risk
  ) {
    case "CRITICAL":
      return 4;

    case "HIGH":
      return 3;

    case "MEDIUM":
      return 2;

    default:
      return 1;
  }
}


export async function analyzeSoftOneScriptProject(
  folder: string,
): Promise<SoftOneProjectAnalysis> {
  const root =
    resolve(
      folder,
    );


  const scriptFiles =
    await discoverScriptFiles(
      root,
    );


  const files:
    SoftOneProjectScriptAnalysis[] = [];


  for (
    const absolutePath
    of scriptFiles
  ) {
    const source =
      await readFile(
        absolutePath,
        "utf8",
      );


    const decoded =
      decodeSoftOneScript(
        source,
      );


    const structure =
      analyzeSoftOneScriptStructure(
        source,
      );


    const runtimeInvocations =
      analyzeSoftOneRuntimeInvocations(
        source,
        structure,
      );


    const businessOperations =
      synthesizeSoftOneBusinessOperations(
        decoded,
        runtimeInvocations,
      );


    const risk =
      classifySoftOneScriptRisk(
        decoded,
        businessOperations,
      );


    files.push({
      file:
        relative(
          root,
          absolutePath,
        ).replace(
          /\\/g,
          "/",
        ),

      absolutePath,

      bytes:
        Buffer.byteLength(
          source,
          "utf8",
        ),

      source,

      decoded,

      structure,

      runtimeInvocations,

      businessOperations,

      risk,
    });
  }


  const functions:
    SoftOneProjectFunctionRef[] =
    files.flatMap(
      file =>
        file.structure.functions.map(
          fn => ({
            id:
              `${file.file}::${fn.name}`,

            file:
              file.file,

            name:
              fn.name,

            parameters:
              fn.parameters,

            eventHandler:
              fn.eventHandler,

            locallyReachableFromEvent:
              fn.reachableFromEvents,
          }),
        ),
    );


  const fileStems =
    files.map(
      file => ({
        file:
          file.file,

        stem:
          canonicalStem(
            file.file,
          ),

        baseStem:
          canonicalStem(
            file.file.split("/").at(-1) ??
              file.file,
          ),
      }),
    );


  const includes:
    SoftOneProjectIncludeRef[] = [];


  for (
    const file
    of files
  ) {
    for (
      const include
      of file.structure.includes
    ) {
      const wanted =
        include.library
          .trim()
          .toLowerCase();


      const resolvedFiles =
        fileStems
          .filter(
            candidate =>
              candidate.stem ===
                wanted ||
              candidate.baseStem ===
                wanted ||
              candidate.stem.endsWith(
                `/${wanted}`,
              ),
          )
          .map(
            candidate =>
              candidate.file,
          );


      includes.push({
        file:
          file.file,

        library:
          include.library,

        resolvedFiles,

        resolved:
          resolvedFiles.length >
          0,
      });
    }
  }


  /*
   * Count actual source-level runtime invocations rather than
   * decoder representations. The decoder may retain both partial
   * and resolved representations of the same SQL call.
   */
  const directSqlReadCount =
    files.reduce(
      (
        total,
        file,
      ) =>
        total +
        file.runtimeInvocations
          .directSqlReadCount,
      0,
    );


  const directSqlWriteCount =
    files.reduce(
      (
        total,
        file,
      ) =>
        total +
        file.businessOperations.filter(
          operation =>
            operation.type ===
              "DIRECT_SQL_WRITE",
        ).length,
      0,
    );


  const highestRisk =
    files
      .map(
        file =>
          file.risk.riskLevel,
      )
      .sort(
        (
          a,
          b,
        ) =>
          riskRank(
            b,
          ) -
          riskRank(
            a,
          ),
      )[0] ??
    "LOW";


  const linkGraph =
    linkSoftOneScriptProject(
      files,
      includes,
    );


  /*
   * Business operations are synthesized per file before the
   * cross-file execution graph exists. Enrich them here with
   * deterministic project-level function identity/reachability.
   */
  const reachableFunctionIds =
    new Set(
      linkGraph.projectReachableFunctions,
    );


  for (
    const file
    of files
  ) {
    for (
      const operation
      of file.businessOperations
    ) {
      if (
        !operation.functionName
      ) {
        continue;
      }


      const functionId =
        `${file.file}::${operation.functionName}`;


      operation.functionId =
        functionId;

      operation.active =
        reachableFunctionIds.has(
          functionId,
        );
    }
  }


  const fieldIndex =
    buildSoftOneProjectFieldIndex(
      files,
      linkGraph,
    );


  const semanticContext =
    buildSoftOneProjectSemanticContext(
      files,
      linkGraph,
      fieldIndex,
    );


  const dataFlow =
    buildSoftOneProjectDataFlowGraph(
      files,
      linkGraph,
    );


  const argumentLineage =
    buildSoftOneProjectArgumentLineage(
      files,
      linkGraph,
    );


  const valueLineage =
    buildSoftOneProjectValueLineageGraph(
      argumentLineage,
    );


  const executionSemantics =
    analyzeSoftOneProjectExecutionSemantics(
      files,
      linkGraph,
    );


  const semanticGraph =
    buildSoftOneProjectSemanticGraph(
      files,
      linkGraph,
      semanticContext,
      executionSemantics,
      dataFlow,
      valueLineage,
    );


  return {
    root,

    fileCount:
      files.length,

    files,

    functions,

    eventHandlers:
      functions.filter(
        fn =>
          fn.eventHandler,
      ),

    includes,

    linkGraph,

    fieldIndex,

    semanticContext,

    semanticGraph,

    dataFlow,

    argumentLineage,

    valueLineage,

    executionSemantics,

    constructs:
      buildConstructIndex(
        files,
      ),

    tables:
      buildConstructIndex(
        files,
        "TABLE",
      ),

    objects:
      buildConstructIndex(
        files,
        "OBJECT",
      ),

    fields:
      buildConstructIndex(
        files,
        "FIELD",
      ),

    systemParameters:
      buildConstructIndex(
        files,
        "SYSTEM_PARAMETER",
      ),

    summary: {
      businessOperationCount:
        files.reduce(
          (
            total,
            file,
          ) =>
            total +
            file.businessOperations.length,
          0,
        ),

      directSqlReadCount,

      directSqlWriteCount,

      filesWithBusinessWrites:
        files.filter(
          file =>
            file.risk
              .mutatesBusinessData,
        ).length,

      filesWithDirectDatabaseAccess:
        files.filter(
          file =>
            file.decoded.operations
              .includes(
                "DIRECT_DATABASE_QUERY",
              ),
        ).length,

      filesWithIncludes:
        files.filter(
          file =>
            file.structure
              .includes.length >
            0,
        ).length,

      unresolvedIncludeCount:
        includes.filter(
          include =>
            !include.resolved,
        ).length,

      highestRisk,
    },
  };
}
