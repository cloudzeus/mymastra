import {
  resolveSoftOneConstructCompatibility,
} from "../src/mastra/softone/construct-compatibility-resolver";


const construct =
  process.argv
    .slice(
      2,
    )
    .join(
      " ",
    );


if (
  !construct
) {
  throw new Error(
    "Usage: npx tsx scripts/query-softone-construct-compatibility.ts <construct>",
  );
}


const result =
  resolveSoftOneConstructCompatibility(
    construct,
  );


console.log(
  JSON.stringify(
    result,
    null,
    2,
  ),
);
