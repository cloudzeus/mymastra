import {
  analyzeSoftOneScriptProject,
} from "../src/mastra/softone/script-project-analyzer";


const folder =
  process.argv[2];


if (
  !folder
) {
  throw new Error(
    "Usage: npx tsx scripts/analyze-softone-script-project.ts <folder>",
  );
}


const project =
  await analyzeSoftOneScriptProject(
    folder,
  );


console.log(
  JSON.stringify(
    project,
    null,
    2,
  ),
);
