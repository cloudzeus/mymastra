import {
  readFile,
} from "node:fs/promises";

import {
  enrichSoftOneImplementationMetadata,
  redactImplementationSecrets,
} from "../src/mastra/softone/implementation-metadata-enricher";


async function main() {
  const [
    connectionId,
    object,
    sourcePath,
  ] =
    process.argv.slice(
      2,
    );


  if (
    !connectionId ||
    !object ||
    !sourcePath
  ) {
    throw new Error(
      "Usage: test-softone-implementation-enrichment <connectionId> <object> <javascript-file>",
    );
  }


  const originalSource =
    await readFile(
      sourcePath,
      "utf8",
    );


  const safeSource =
    redactImplementationSecrets(
      originalSource,
    );


  console.error(
    safeSource === originalSource
      ? "INFO: no credential-like values were redacted"
      : "OK: credential-like values were redacted before any LLM usage",
  );


  const result =
    await enrichSoftOneImplementationMetadata({
      connectionId,
      object,
      sourceCode:
        safeSource,
    });


  console.log(
    JSON.stringify(
      {
        object:
          result.object,

        verified:
          result.verified.map(
            evidence => ({
              requested:
                `${evidence.identifier.logicalTable}.${evidence.identifier.field}`,

              reference:
                evidence.identifier.reference,

              origin:
                evidence.identifier.origin,

              physicalTable:
                evidence.identifier.physicalTable,

              source:
                evidence.resolution.source,

              liveRequestPerformed:
                evidence.resolution.liveRequestPerformed,

              field:
                evidence.resolution.field
                  ? {
                      name:
                        evidence.resolution.field.name,

                      fullname:
                        evidence.resolution.field.fullname,

                      caption:
                        evidence.resolution.field.caption,

                      type:
                        evidence.resolution.field.type,

                      editor:
                        evidence.resolution.field.editor,

                      required:
                        evidence.resolution.field.required,
                    }
                  : undefined,
            }),
          ),

        unresolved:
          result.unresolved.map(
            identifier => ({
              table:
                identifier.logicalTable,

              field:
                identifier.field,

              reference:
                identifier.reference,

              origin:
                identifier.origin,
            }),
          ),

        unresolvedSqlTables:
          result.unresolvedSqlTables,
      },
      null,
      2,
    ),
  );
}


main().catch(
  error => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
