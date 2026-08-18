import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";
import { MastraEditor } from "@mastra/editor";

import { analystAgent } from "./agents/analyst";
import { developerAgent } from "./agents/developer";
import { researchCompetitorAgent } from "./agents/research-competitor";
import { uiUxDesignerAgent } from "./agents/ui-ux-designer";
import { contentCreatorAgent } from "./agents/content-creator";


if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

export const mastra = new Mastra({
  storage: new PostgresStore({
    id: "mastra-storage",
    connectionString: process.env.DATABASE_URL,
  }),

  editor: new MastraEditor(),

  agents: {
    analystAgent,
    developerAgent,
    researchCompetitorAgent,
    uiUxDesignerAgent,
    contentCreatorAgent,
  },
});
