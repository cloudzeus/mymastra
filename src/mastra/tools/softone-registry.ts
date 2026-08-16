import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  getSoftOneObjectRegistryEntry,
  normalizeSoftOneObjectName,
} from "../softone/registry";

export const softoneObjectRegistryLookup = createTool({
  id: "softone-object-registry",

  description: `
Returns canonical SoftOne object identity and known physical SQL mappings.

Use this tool whenever you need to distinguish:
- SoftOne business object
- Web Services/schema table
- physical SQL table
- primary key

Never infer a physical SQL table when this tool does not provide one.
`,

  inputSchema: z.object({
    object: z
      .string()
      .min(1)
      .describe(
        "SoftOne object or known alias, e.g. ITEM, CUSTOMER, SALDOC",
      ),
  }),

  execute: async ({ object }) => {
    const normalized =
      normalizeSoftOneObjectName(object);

    const entry =
      getSoftOneObjectRegistryEntry(normalized);

    if (!entry) {
      return {
        found: false,
        object: normalized,
        physicalMasterTable: null,
        primaryKey: null,
        provenance: "registry",
        verified: false,
        message:
          "Object is not present in the canonical registry. Do not infer its physical SQL table.",
      };
    }

    return {
      found: true,

      ...entry,

      provenance: "registry",
      verified: true,
    };
  },
});
