import {
  resolveSoftOneMetadata,
} from "../src/mastra/softone/targeted-metadata-resolver";

import {
  analystAgent,
} from "../src/mastra/agents/analyst";


const connectionId =
  process.argv[2];

const objectName =
  process.argv[3] ?? "ITEM";

const tableName =
  process.argv[4] ?? "ITEM";

const fieldName =
  process.argv[5] ?? "cccSubgoup2";


if (
  !connectionId
) {
  throw new Error(
    "Usage: test-softone-llm-grounding <connectionId> [object] [table] [field]",
  );
}


async function main() {
  /*
   * Resolve the requested field.
   *
   * GLOBAL baseline -> context cache -> targeted live WS
   */
  const resolution =
    await resolveSoftOneMetadata({
      connectionId,
      object:
        objectName,

      table:
        tableName,

      field:
        fieldName,

      preferBaseline:
        true,
    });


  if (
    !resolution.found ||
    !resolution.table ||
    !resolution.field
  ) {
    throw new Error(
      `Unable to resolve ${objectName}.${tableName}.${fieldName}`,
    );
  }


  /*
   * Keep prompt context compact.
   *
   * Include the target field plus a few important fields
   * from the same table so the LLM understands the table.
   */
  const wantedFields =
    new Set([
      "MTRL",
      "CODE",
      "NAME",
      "CODE1",
      "CODE2",
      fieldName.toUpperCase(),
    ]);


  const fields =
    Object.entries(
      resolution.table.fields,
    )
      .filter(
        ([name]) =>
          wantedFields.has(
            name.toUpperCase(),
          ),
      )
      .map(
        ([, field]) => ({
          name:
            field.name,

          fullname:
            field.fullname,

          caption:
            field.caption,

          type:
            field.type,

          editor:
            field.editor,

          required:
            field.required,
        }),
      );


  const schemaContext = {
    evidence: {
      source:
        resolution.source,

      liveRequestPerformed:
        resolution.liveRequestPerformed,

      scope:
        resolution.source ===
          "GLOBAL_BASELINE"
          ? "GLOBAL"
          : "AUTHENTICATED_CONTEXT",
    },

    object: {
      name:
        resolution.object,
    },

    table: {
      logicalName:
        resolution.table.name,

      physicalName:
        resolution.table.physicalName,

      caption:
        resolution.table.caption,

      fillType:
        resolution.table.fillType,
    },

    fields,
  };


  const prompt = `
Είσαι Business/Technical Analyst για SoftOne.

Χρησιμοποίησε ΑΠΟΚΛΕΙΣΤΙΚΑ το παρακάτω verified metadata.
Μην εφεύρεις SoftOne objects, tables, fields, mappings ή semantics.

Αν κάτι δεν αποδεικνύεται από το metadata, πες ρητά:
"Δεν είναι επιβεβαιωμένο από το διαθέσιμο metadata."

VERIFIED SOFTONE METADATA:

${JSON.stringify(
  schemaContext,
  null,
  2,
)}

ΕΡΩΤΗΣΗ:

Για το SoftOne object ${objectName}:
1. Ποιο είναι το logical master table;
2. Ποιο είναι το physical DB table;
3. Υπάρχει το field ${fieldName};
4. Ποιο είναι το type, caption και editor του;
5. Είναι global ή επιβεβαιωμένο για το συγκεκριμένο authenticated context;
6. Μην αποδώσεις business meaning πέρα από ό,τι αποδεικνύεται από caption/type/editor.
`.trim();


  console.error(
    "\n=== PROMPT CONTEXT ===\n",
  );

  console.error(
    JSON.stringify(
      schemaContext,
      null,
      2,
    ),
  );


  console.error(
    "\n=== RUNNING ACTUAL ANALYST AGENT ===\n",
  );


  const result =
    await analystAgent.generate(
      prompt,
    );


  console.log(
    "\n=== LLM ANSWER ===\n",
  );


  console.log(
    result.text,
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
