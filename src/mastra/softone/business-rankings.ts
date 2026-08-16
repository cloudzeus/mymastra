import type { SoftOneSemanticNode } from "./semantic-types";

export const SOFTONE_BUSINESS_RANKINGS: SoftOneSemanticNode[] = [
  {
    id: "BEST_PRODUCTS_BY_QUANTITY",
    type: "RANKING",

    concept: "best selling products by quantity",
    description:
      "Ranks ITEM_SALES_PERFORMANCE by TOTAL_QTY_SOLD descending.",

    businessObjects: ["ITEM"],

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    dependsOn: [
      "ITEM_SALES_PERFORMANCE",
    ],

    outputs: [
      "TOTAL_QTY_SOLD DESC",
    ],

    tags: [
      "sales",
      "quantity",
      "ranking",
    ],
  },

  {
    id: "BEST_PRODUCTS_BY_PROFIT",
    type: "RANKING",

    concept: "best products by gross profit",
    description:
      "Ranks ITEM_SALES_PERFORMANCE by GROSS_PROFIT descending.",

    businessObjects: ["ITEM"],

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    dependsOn: [
      "ITEM_SALES_PERFORMANCE",
    ],

    outputs: [
      "GROSS_PROFIT DESC",
    ],

    tags: [
      "sales",
      "profit",
      "ranking",
    ],
  },
];
