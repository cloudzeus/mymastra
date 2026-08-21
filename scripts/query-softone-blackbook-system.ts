import {
  findSoftOneBlackBookSystemEntry,
  searchSoftOneBlackBookSystemRegistry,
} from "../src/mastra/softone/blackbook-system-registry";

import type {
  SoftOneBlackBookSystemRegistry,
} from "../src/mastra/softone/blackbook-system-registry";


const registry =
  process.argv[2] as
    SoftOneBlackBookSystemRegistry | undefined;

const query =
  process.argv
    .slice(
      3,
    )
    .join(
      " ",
    );


if (
  !registry ||
  !query
) {
  throw new Error(
    "Usage: <X.SYS|ACMD|COMMAND_SWITCH|XCO|PARAMS.CFG|OBJECT_PARAMETER> <query>",
  );
}


const exact =
  findSoftOneBlackBookSystemEntry(
    registry,
    query,
  );


const results =
  exact.length > 0
    ? exact
    : searchSoftOneBlackBookSystemRegistry(
        query,
        registry,
      );


console.table(
  results,
);
