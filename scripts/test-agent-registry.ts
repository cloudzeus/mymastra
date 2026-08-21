import {
  getDeliveryAgent,
  hasDeliveryAgent,
  listRegisteredDeliveryAgentRoles,
  planningAgentRegistry,
} from "../src/mastra/execution";


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


const expectedRoles = [
  "RESEARCH_COMPETITOR",
  "UI_UX_DESIGNER",
  "SEARCH_VISIBILITY",
  "COPYWRITER",
  "CONTENT_CREATOR",
  "DEVELOPER",
] as const;


console.log(
  "--- DELIVERY AGENT REGISTRY ---",
);


const registered =
  listRegisteredDeliveryAgentRoles()
    .sort();


console.log(
  "registered roles:",
  registered,
);


for (
  const role of expectedRoles
) {
  assert(
    hasDeliveryAgent(role),
    `Missing delivery agent: ${role}`,
  );

  const agent =
    getDeliveryAgent(role);


  assert(
    agent,
    `Agent resolution failed: ${role}`,
  );


  assert(
    typeof agent.generate ===
      "function",
    `${role} does not expose generate()`,
  );


  console.log(
    `PASS ${role}`,
  );
}


assert(
  planningAgentRegistry
    .BUSINESS_TECHNICAL_ANALYST,
  "Analyst planning agent missing",
);


assert(
  typeof planningAgentRegistry
    .BUSINESS_TECHNICAL_ANALYST
    .generate ===
    "function",
  "Analyst does not expose generate()",
);


console.log(
  "PASS BUSINESS_TECHNICAL_ANALYST",
);


console.log(
  "\n========================================",
);

console.log(
  "AGENT REGISTRY TEST: PASS",
);

console.log(
  "========================================",
);
