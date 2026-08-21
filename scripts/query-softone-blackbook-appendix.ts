import {
  findSoftOneAppendixByCode,
  searchSoftOneAppendixRegistry,
} from "../src/mastra/softone/blackbook-appendix-registry";

import type {
  SoftOneBlackBookAppendixRegistry,
} from "../src/mastra/softone/blackbook-appendix-registry";


const registry =
  process.argv[2] as
    SoftOneBlackBookAppendixRegistry | undefined;

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
    "Usage: <SODTYPE|SOSOURCE|ORIGIN|CSTTYPE> <code or text>",
  );
}


const byCode =
  findSoftOneAppendixByCode(
    registry,
    query,
  );


const result =
  byCode.length
    ? byCode
    : searchSoftOneAppendixRegistry(
        query,
        registry,
      );


console.table(
  result,
);
