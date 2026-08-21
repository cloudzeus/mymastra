import {
  createSpecialistAgentHandler,
} from "./specialist-agent-adapter";

import {
  developerAgentHandler,
} from "./developer-agent-adapter";

import type {
  StageExecutionHandlerRegistry,
} from "./orchestrator-types";


export const productionStageHandlers:
  StageExecutionHandlerRegistry = {

  RESEARCH_COMPETITOR:
    createSpecialistAgentHandler(
      "RESEARCH_COMPETITOR",
      "RESEARCH_PACKAGE",
    ),

  UI_UX_DESIGNER:
    createSpecialistAgentHandler(
      "UI_UX_DESIGNER",
      "UX_DESIGN_PACKAGE",
    ),

  SEARCH_VISIBILITY:
    createSpecialistAgentHandler(
      "SEARCH_VISIBILITY",
      "SEARCH_VISIBILITY_PACKAGE",
    ),

  COPYWRITER:
    createSpecialistAgentHandler(
      "COPYWRITER",
      "COPY_PACKAGE",
    ),

  CONTENT_CREATOR:
    createSpecialistAgentHandler(
      "CONTENT_CREATOR",
      "CREATIVE_CONTENT_PACKAGE",
    ),

  DEVELOPER:
    developerAgentHandler,

  QUALITY_ASSURANCE:
    createSpecialistAgentHandler(
      "QUALITY_ASSURANCE",
      "QA_REPORT",
    ),
};
