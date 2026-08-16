import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";

import { analystAgent } from "./agents/analyst";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

export const mastra = new Mastra({
  storage: new PostgresStore({
    id: "mastra-storage",
    connectionString: process.env.DATABASE_URL,
  }),

  agents: {
    analystAgent,
  },
});
