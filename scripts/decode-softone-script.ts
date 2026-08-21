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
  synthesizeSoftOneBusinessOperations,
} from "../src/mastra/softone/business-operation-synthesizer";

import {
  classifySoftOneScriptRisk,
} from "../src/mastra/softone/script-risk-classifier";

import {
  createSoftOneSemanticReport,
  formatSoftOneSemanticReport,
} from "../src/mastra/softone/script-semantic-report";

import {
  buildSoftOneSemanticLlmContext,
} from "../src/mastra/softone/semantic-llm-context";

import {
  analyzeSoftOneScriptStructure,
} from "../src/mastra/softone/script-structure-analyzer";

import {
  explainSoftOneSemanticsWithLlm,
} from "../src/mastra/softone/semantic-llm-explainer";


const fileName =
  process.argv[2];


if (
  !fileName
) {
  throw new Error(
    "Usage: npx tsx scripts/decode-softone-script.ts <script-file>",
  );
}


const path =
  resolve(
    process.cwd(),
    fileName,
  );


const source =
  readFileSync(
    path,
    "utf8",
  );


const decoded =
  decodeSoftOneScript(
    source,
  );


const scriptStructure =
  analyzeSoftOneScriptStructure(
    source,
  );


const businessOperations =
  synthesizeSoftOneBusinessOperations(
    decoded,
  );


const riskAssessment =
  classifySoftOneScriptRisk(
    decoded,
    businessOperations,
  );


const semanticReport =
  createSoftOneSemanticReport(
    decoded,
    businessOperations,
    riskAssessment,
  );


const explainMode =
  process.argv.includes(
    "--explain",
  );


if (
  explainMode
) {
  const llmContext =
    buildSoftOneSemanticLlmContext(
      decoded,
      businessOperations,
      riskAssessment,
    );


  const explanation =
    await explainSoftOneSemanticsWithLlm(
      llmContext,
    );


  console.log(
    JSON.stringify(
      explanation,
      null,
      2,
    ),
  );


  process.exit(
    0,
  );
}


const reportMode =
  process.argv.includes(
    "--report",
  );


if (
  reportMode
) {
  console.log(
    formatSoftOneSemanticReport(
      semanticReport,
    ),
  );

  process.exit(
    0,
  );
}


console.log(
  JSON.stringify(
    {
      ...decoded,

      scriptStructure,

      businessOperations,

      riskAssessment,

      semanticReport,
    },
    null,
    2,
  ),
);
