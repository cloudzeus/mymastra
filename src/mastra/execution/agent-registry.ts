import {
  researchCompetitorAgent,
} from "../agents/research-competitor";

import {
  uiUxDesignerAgent,
} from "../agents/ui-ux-designer";

import {
  searchVisibilityAgent,
} from "../agents/search-visibility";

import {
  copywriterAgent,
} from "../agents/copywriter";

import {
  contentCreatorAgent,
} from "../agents/content-creator";

import {
  developerAgent,
} from "../agents/developer";

import {
  qaAgent,
} from "../agents/qa";

import {
  analystAgent,
} from "../agents/analyst";

import type {
  ProjectExecutionAgentRole,
} from "./types";


const deliveryAgentRegistry = {
  RESEARCH_COMPETITOR:
    researchCompetitorAgent,

  UI_UX_DESIGNER:
    uiUxDesignerAgent,

  SEARCH_VISIBILITY:
    searchVisibilityAgent,

  COPYWRITER:
    copywriterAgent,

  CONTENT_CREATOR:
    contentCreatorAgent,

  DEVELOPER:
    developerAgent,

  QUALITY_ASSURANCE:
    qaAgent,
} as const satisfies Partial<
  Record<
    ProjectExecutionAgentRole,
    unknown
  >
>;


/*
 * Runtime agent type is derived from the registry itself.
 *
 * Different Mastra agents expose different tool generics, therefore
 * they must not all be forced into the concrete generic type of one
 * particular agent.
 */
export type RegisteredMastraAgent =
  (
    typeof deliveryAgentRegistry
  )[
    keyof typeof deliveryAgentRegistry
  ];


/*
 * Analyst is intentionally separate.
 *
 * BUSINESS_TECHNICAL_ANALYST belongs primarily
 * to presales / ProjectDefinition planning,
 * not to the delivery-stage taxonomy currently
 * persisted by ProjectExecutionPlan.
 */
export const planningAgentRegistry = {
  BUSINESS_TECHNICAL_ANALYST:
    analystAgent,
} as const;


export function hasDeliveryAgent(
  role: ProjectExecutionAgentRole,
): boolean {
  return (
    role in
    deliveryAgentRegistry
  );
}


export function getDeliveryAgent(
  role: ProjectExecutionAgentRole,
): RegisteredMastraAgent {
  const agent =
    deliveryAgentRegistry[
      role as keyof
        typeof deliveryAgentRegistry
    ];


  if (!agent) {
    throw new Error(
      `No Mastra delivery agent registered for role=${role}`,
    );
  }


  return agent;
}


export function listRegisteredDeliveryAgentRoles():
  ProjectExecutionAgentRole[] {
  return Object.keys(
    deliveryAgentRegistry,
  ) as
    ProjectExecutionAgentRole[];
}
