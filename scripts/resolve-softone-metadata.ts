import {
  resolveSoftOneMetadata,
} from "../src/mastra/softone/targeted-metadata-resolver";


async function main():
  Promise<void> {
  const [
    connectionId,
    object,
    table,
    field,
  ] =
    process.argv.slice(
      2,
    );


  if (
    !connectionId ||
    !object
  ) {
    throw new Error(
      "Usage: resolve-softone-metadata <connectionId> <object> [table] [field]",
    );
  }


  const result =
    await resolveSoftOneMetadata({
      connectionId,
      object,
      table:
        table ||
        undefined,

      field:
        field ||
        undefined,

      preferBaseline:
        true,
    });


  console.log(
    JSON.stringify(
      result,
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
