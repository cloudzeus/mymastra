import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  promoteCapabilityToSharedSkill,
} from "../src/mastra/knowledge/shared-skill-manager";


async function main() {
  const canonicalKey =
    process.argv[2];


  if (!canonicalKey) {
    throw new Error(
      "Usage: npx tsx scripts/promote-shared-skill.ts <CANONICAL_KEY>",
    );
  }


  const skill =
    await promoteCapabilityToSharedSkill(
      canonicalKey,
    );


  console.log(
    "SHARED SKILL PROMOTED:",
    skill,
  );
}


main()
  .catch(
    error => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await appDb.end();
    },
  );
