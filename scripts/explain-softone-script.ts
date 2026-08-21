import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  decodeSoftOneScript,
} from "../src/mastra/softone/advanced-javascript-decoder";

import {
  explainSoftOneDecodedScript,
} from "../src/mastra/softone/script-semantic-explainer";


const fileName =
  process.argv[2];


if (
  !fileName
) {
  throw new Error(
    "Usage: npx tsx scripts/explain-softone-script.ts <script-file>",
  );
}


const source =
  readFileSync(
    resolve(
      process.cwd(),
      fileName,
    ),
    "utf8",
  );


const decoded =
  decodeSoftOneScript(
    source,
  );


const explanation =
  explainSoftOneDecodedScript(
    decoded,
  );


console.log(
  JSON.stringify(
    {
      decoded,
      explanation,
    },
    null,
    2,
  ),
);
