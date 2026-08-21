import {
  analyzeSoftOneScriptProject,
} from "../src/mastra/softone/script-project-analyzer";

import {
  explainSoftOneSemanticGraph,
} from "../src/mastra/softone/semantic-llm-explainer";


async function main(): Promise<void> {
  const root =
    process.argv[2];


  if (
    !root
  ) {
    throw new Error(
      "Usage: npx tsx scripts/explain-softone-script-project.ts <folder>",
    );
  }


  const project =
    await analyzeSoftOneScriptProject(
      root,
    );


  const explanation =
    await explainSoftOneSemanticGraph(
      project.semanticGraph,
    );


  process.stdout.write(
    JSON.stringify(
      explanation,
      null,
      2,
    ) +
    "\n",
  );
}


main().catch(
  error => {
    console.error(
      error,
    );

    process.exit(
      1,
    );
  },
);
