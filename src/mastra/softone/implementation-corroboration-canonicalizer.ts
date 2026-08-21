import type {
  SoftOneImplementationCorroborationGroup,
} from "./implementation-corroboration-types";


export interface CanonicalizedCorroborationGroup {
  group:
    SoftOneImplementationCorroborationGroup;

  canonicalKey:
    string;

  canonicalClaim:
    string;

  implementationCorroborated:
    boolean;

  eligibleForAuthoritativeReview:
    boolean;

  canonicalPromotionAllowed:
    boolean;

  promotionReason:
    string;
}


export function canonicalizeSoftOneCorroborationGroup(
  group:
    SoftOneImplementationCorroborationGroup,
): CanonicalizedCorroborationGroup {
  switch (
    group.key
  ) {
    case "WINDOWS_1253_RESPONSE_DECODE":
    case "WIN1253_RESPONSE_DECODING":
    case "WINDOWS_1253_RESPONSE_DECODING":
      return {
        group,

        canonicalKey:
          "SOFTONE_WS_WINDOWS_1253_RESPONSE_DECODING",

        canonicalClaim:
          "Multiple independent SoftOne Web Services implementations consume response bodies as binary buffers and decode them using Windows-1253/cp1253 before JSON parsing.",

        implementationCorroborated:
          group.distinctRepositoryCount >= 3,

        eligibleForAuthoritativeReview:
          group.distinctRepositoryCount >= 3,

        canonicalPromotionAllowed:
          false,

        promotionReason:
          `${group.distinctRepositoryCount} independent repositories support the same response-decoding pattern.`,
      };


    case "CLIENTID_SESSION_PERSISTENCE":
      return {
        group,

        canonicalKey:
          "SOFTONE_CLIENTID_SESSION_REUSE",

        canonicalClaim:
          "Multiple independent implementations reuse the authenticated SoftOne clientID as the session identifier for subsequent Web Services requests.",

        implementationCorroborated:
          group.distinctRepositoryCount >= 3,

        eligibleForAuthoritativeReview:
          group.distinctRepositoryCount >= 3,

        canonicalPromotionAllowed:
          false,

        promotionReason:
          "The SoftOne-specific behavior is clientID reuse; application-specific persistence mechanisms are intentionally excluded.",
      };


    case "SESSION_EXPIRED_ERRORCODE_REAUTH":
      return {
        group,

        canonicalKey:
          "SOFTONE_SESSION_ERROR_REAUTH_PATTERN",

        canonicalClaim:
          "Multiple independent implementations interpret SoftOne error codes -100 and -101 as stale or invalid session conditions and respond by re-authenticating before retrying the request.",

        implementationCorroborated:
          group.distinctRepositoryCount >= 3,

        eligibleForAuthoritativeReview:
          group.distinctRepositoryCount >= 3,

        canonicalPromotionAllowed:
          false,

        promotionReason:
          `${group.distinctRepositoryCount} independent implementations contain the same error-code re-authentication pattern.`,
      };


    case "TRDR_TABLE_AS_CUSTOMER_SUPPLIER_IDENTITY":
      return {
        group,

        canonicalKey:
          "SOFTONE_TRDR_AS_TRADER_SYNC_KEY",

        canonicalClaim:
          "Multiple independent implementations use the SoftOne TRDR field as the primary identifier when synchronizing trader/customer/supplier records into external application stores.",

        implementationCorroborated:
          group.distinctRepositoryCount >= 3,

        eligibleForAuthoritativeReview:
          group.distinctRepositoryCount >= 3,

        canonicalPromotionAllowed:
          false,

        promotionReason:
          "The evidence supports TRDR usage as a synchronization key; it does not by itself establish universal canonical identity semantics.",
      };


    case "LOGIN_RESPONSE_CLIENTID_AND_EXTENDED_FIELDS":
      return {
        group,

        canonicalKey:
          "SOFTONE_LOGIN_RESPONSE_CLIENTID_FIELDS",

        canonicalClaim:
          "Multiple implementations parse successful SoftOne login responses for clientID and also observe fields including s1u, hyperlinks, canexport, image and companyinfo.",

        implementationCorroborated:
          group.distinctRepositoryCount >= 2,

        eligibleForAuthoritativeReview:
          group.distinctRepositoryCount >= 2,

        canonicalPromotionAllowed:
          false,

        promotionReason:
          `${group.distinctRepositoryCount} independent implementations observe the same login response field set.`,
      };


    default:
      return {
        group,

        canonicalKey:
          `IMPLEMENTATION_${group.key}`,

        canonicalClaim:
          group.normalizedClaim,

        implementationCorroborated:
          false,

        eligibleForAuthoritativeReview:
          false,

        canonicalPromotionAllowed:
          false,

        promotionReason:
          "No deterministic canonicalization rule exists for this corroboration group.",
      };
  }
}
