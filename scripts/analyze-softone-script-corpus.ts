import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";

import {
  extname,
  join,
  resolve,
} from "node:path";

import {
  decodeSoftOneScript,
} from "../src/mastra/softone/advanced-javascript-decoder";


const rootArg =
  process.argv[2];


if (
  !rootArg
) {
  throw new Error(
    "Usage: npx tsx scripts/analyze-softone-script-corpus.ts <directory>",
  );
}


const root =
  resolve(
    process.cwd(),
    rootArg,
  );


if (
  !existsSync(
    root,
  )
) {
  throw new Error(
    `Directory does not exist: ${root}`,
  );
}


const allowed =
  new Set([
    ".js",
    ".txt",
    ".cst",
  ]);


function walk(
  dir: string,
): string[] {
  const files:
    string[] = [];


  for (
    const name
    of readdirSync(
      dir,
    )
  ) {
    const full =
      join(
        dir,
        name,
      );


    const stat =
      statSync(
        full,
      );


    if (
      stat.isDirectory()
    ) {
      files.push(
        ...walk(
          full,
        ),
      );

      continue;
    }


    if (
      allowed.has(
        extname(
          name,
        ).toLowerCase(),
      )
    ) {
      files.push(
        full,
      );
    }
  }


  return files;
}


const files =
  walk(
    root,
  );


const totals = {
  files:
    0,

  decoded:
    0,

  constructs:
    0,

  canonical:
    0,

  authoritative:
    0,

  sqlStatements:
    0,

  webServiceCalls:
    0,

  executionEdges:
    0,
};


const unknownConstructs =
  new Map<
    string,
    number
  >();


const runtimeFunctions =
  new Map<
    string,
    number
  >();


const tables =
  new Map<
    string,
    number
  >();


const objects =
  new Map<
    string,
    number
  >();


const semanticValues =
  new Map<
    string,
    number
  >();


const surfaces =
  new Map<
    string,
    number
  >();


const failures:
  Array<{
    file: string;
    error: string;
  }> = [];


function count(
  map:
    Map<string, number>,
  key:
    string,
): void {
  map.set(
    key,
    (
      map.get(
        key,
      ) ??
      0
    ) + 1,
  );
}


for (
  const file
  of files
) {
  totals.files +=
    1;


  try {
    const source =
      readFileSync(
        file,
        "utf8",
      );


    const decoded =
      decodeSoftOneScript(
        source,
      );


    totals.decoded +=
      1;

    totals.constructs +=
      decoded.constructs.length;

    totals.sqlStatements +=
      decoded.sql.length;

    totals.webServiceCalls +=
      decoded.webServices.length;

    totals.executionEdges +=
      decoded.executionEdges.length;


    count(
      surfaces,
      decoded.hostSurface,
    );


    for (
      const edge
      of decoded.executionEdges
    ) {
      count(
        surfaces,
        edge.to,
      );
    }


    for (
      const construct
      of decoded.constructs
    ) {
      if (
        construct.canonical
      ) {
        totals.canonical +=
          1;
      }


      if (
        construct.compatibility?.authoritative
      ) {
        totals.authoritative +=
          1;
      }


      if (
        !construct.canonical
      ) {
        count(
          unknownConstructs,
          `${construct.type}:${construct.value}`,
        );
      }


      if (
        construct.type ===
          "FUNCTION"
      ) {
        count(
          runtimeFunctions,
          construct.value,
        );
      }


      if (
        construct.type ===
          "TABLE"
      ) {
        count(
          tables,
          construct.value,
        );
      }


      if (
        construct.type ===
          "OBJECT"
      ) {
        count(
          objects,
          construct.value,
        );
      }
    }


    for (
      const value
      of decoded.semanticValues
    ) {
      count(
        semanticValues,
        `${value.registry}:${value.code}:${value.meaning ?? "UNKNOWN"}`,
      );
    }
  }
  catch (
    error
  ) {
    failures.push({
      file,

      error:
        error instanceof
          Error
          ? error.message
          : String(
              error,
            ),
    });
  }
}


function top(
  map:
    Map<string, number>,
  limit =
    30,
) {
  return [
    ...map.entries(),
  ]
    .sort(
      (
        a,
        b,
      ) =>
        b[1] -
        a[1],
    )
    .slice(
      0,
      limit,
    )
    .map(
      (
        [
          value,
          countValue,
        ],
      ) => ({
        value,

        count:
          countValue,
      }),
    );
}


console.log(
  JSON.stringify(
    {
      root,

      totals,

      coverage: {
        canonicalPercent:
          totals.constructs
            ? Number(
                (
                  totals.canonical /
                  totals.constructs *
                  100
                ).toFixed(
                  2,
                ),
              )
            : 0,

        authoritativePercent:
          totals.constructs
            ? Number(
                (
                  totals.authoritative /
                  totals.constructs *
                  100
                ).toFixed(
                  2,
                ),
              )
            : 0,
      },

      topRuntimeFunctions:
        top(
          runtimeFunctions,
        ),

      topTables:
        top(
          tables,
        ),

      topObjects:
        top(
          objects,
        ),

      semanticValues:
        top(
          semanticValues,
        ),

      executionSurfaces:
        top(
          surfaces,
        ),

      unresolvedConstructs:
        top(
          unknownConstructs,
          100,
        ),

      failures,
    },
    null,
    2,
  ),
);
