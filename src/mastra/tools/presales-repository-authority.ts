import type {
  RequestContext,
} from "@mastra/core/request-context";

import type {
  PresalesRepositoryAuthority,
} from "../presales/presales-repository-gateway";


export type PresalesRepositoryRequestContext = {
  tenantId: string;
  customerId: string;
  opportunityId: string;
};


function requireContextUuid(
  requestContext:
    RequestContext<PresalesRepositoryRequestContext>,

  key:
    "tenantId"
    | "customerId"
    | "opportunityId",
): string {
  const value =
    requestContext.get(key);


  if (
    typeof value !==
      "string" ||
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      value,
    )
  ) {
    throw new Error(
      `Presales repository BLOCKED: RequestContext<PresalesRepositoryRequestContext>.${key} is required`,
    );
  }


  return value;
}


export function getPresalesRepositoryAuthorityFromContext(
  requestContext:
    RequestContext<PresalesRepositoryRequestContext>,
): PresalesRepositoryAuthority {
  return {
    tenantId:
      requireContextUuid(
        requestContext,
        "tenantId",
      ),

    customerId:
      requireContextUuid(
        requestContext,
        "customerId",
      ),

    opportunityId:
      requireContextUuid(
        requestContext,
        "opportunityId",
      ),
  };
}
