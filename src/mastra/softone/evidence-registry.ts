import {
  getSoftOneSource,
} from "./source-registry";

import type {
  SoftOneEvidenceRecord,
  SoftOneEvidenceStatus,
  SoftOneEvidenceValidation,
} from "./evidence-types";

const records = new Map<
  string,
  SoftOneEvidenceRecord
>();

function normalize(
  value: string,
): string {
  return value.trim().toUpperCase();
}

function statusRank(
  status: SoftOneEvidenceStatus,
): number {
  switch (status) {
    case "VERIFIED":
      return 3;

    case "DERIVED":
      return 2;

    case "HYPOTHESIS":
      return 1;
  }
}

export function validateSoftOneEvidence(
  record: SoftOneEvidenceRecord,
): SoftOneEvidenceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!record.id.trim()) {
    errors.push("Evidence record id is required.");
  }

  if (!record.claim.trim()) {
    errors.push("Evidence claim is required.");
  }

  if (record.sources.length === 0) {
    errors.push(
      "Evidence record must contain at least one source.",
    );
  }

  if (
    record.scope === "TENANT" &&
    !record.tenantCode?.trim()
  ) {
    errors.push(
      "TENANT evidence requires tenantCode.",
    );
  }

  if (
    record.scope !== "TENANT" &&
    record.tenantCode
  ) {
    warnings.push(
      "tenantCode is present on non-TENANT evidence.",
    );
  }

  const sourceDefinitions =
    record.sources.map(reference => {
      const source =
        getSoftOneSource(
          reference.sourceId,
        );

      if (!source) {
        errors.push(
          `Unknown sourceId: ${reference.sourceId}`,
        );
      }

      return source;
    });

  const knownSources =
    sourceDefinitions.filter(
      source => source !== undefined,
    );

  const authorities =
    knownSources.map(
      source => source.authority,
    );

  const communityOnly =
    knownSources.length > 0 &&
    knownSources.every(
      source =>
        source.authority ===
        "COMMUNITY_EXPERT",
    );

  const inferredOnly =
    knownSources.length > 0 &&
    knownSources.every(
      source =>
        source.authority ===
        "INFERRED",
    );

  let effectiveStatus =
    record.status;

  /*
   * Community knowledge is useful evidence,
   * but a community post alone cannot promote
   * a claim to VERIFIED.
   */
  if (
    record.status === "VERIFIED" &&
    communityOnly
  ) {
    effectiveStatus = "DERIVED";

    warnings.push(
      "Community-only evidence cannot independently establish VERIFIED status. Effective status downgraded to DERIVED.",
    );
  }

  /*
   * Pure inference can never be VERIFIED.
   */
  if (
    record.status === "VERIFIED" &&
    inferredOnly
  ) {
    effectiveStatus =
      "HYPOTHESIS";

    warnings.push(
      "Inference-only evidence cannot establish VERIFIED status.",
    );
  }

  /*
   * Tenant claims need tenant-capable evidence.
   */
  if (
    record.scope === "TENANT"
  ) {
    const hasTenantEvidence =
      knownSources.some(
        source =>
          source.authority ===
            "TENANT_VERIFIED" ||
          source.authority ===
            "USER_VERIFIED",
      );

    if (
      record.status === "VERIFIED" &&
      !hasTenantEvidence
    ) {
      warnings.push(
        "TENANT claim is marked VERIFIED without TENANT_VERIFIED or USER_VERIFIED source evidence.",
      );

      effectiveStatus =
        statusRank(effectiveStatus) >
        statusRank("DERIVED")
          ? "DERIVED"
          : effectiveStatus;
    }
  }

  /*
   * Official documentation can verify
   * documented product behavior, but not
   * installation-specific configuration.
   */
  const officialOnly =
    knownSources.length > 0 &&
    knownSources.every(
      source =>
        source.authority ===
          "OFFICIAL_DOCUMENTATION" ||
        source.authority ===
          "OFFICIAL_TRAINING",
    );

  if (
    officialOnly &&
    record.scope === "TENANT"
  ) {
    warnings.push(
      "Official product documentation does not prove tenant-specific configuration.",
    );

    if (
      effectiveStatus === "VERIFIED"
    ) {
      effectiveStatus = "DERIVED";
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    effectiveStatus,
    sourceAuthorities: [
      ...new Set(authorities),
    ],
  };
}

export function registerSoftOneEvidence(
  record: SoftOneEvidenceRecord,
): SoftOneEvidenceValidation {
  const validation =
    validateSoftOneEvidence(
      record,
    );

  if (!validation.valid) {
    return validation;
  }

  const normalizedId =
    normalize(record.id);

  records.set(
    normalizedId,
    {
      ...record,
      id: normalizedId,
      status:
        validation.effectiveStatus,
    },
  );

  return validation;
}

export function getSoftOneEvidence(
  id: string,
): SoftOneEvidenceRecord | undefined {
  return records.get(
    normalize(id),
  );
}

export function listSoftOneEvidence():
  SoftOneEvidenceRecord[] {
  return [
    ...records.values(),
  ];
}

export function searchSoftOneEvidence(
  query: string,
): SoftOneEvidenceRecord[] {
  const normalized =
    query.trim().toLowerCase();

  if (!normalized) {
    return listSoftOneEvidence();
  }

  return listSoftOneEvidence().filter(
    record => {
      const haystack = [
        record.id,
        record.claim,
        record.kind,
        record.scope,
        record.tenantCode ?? "",
        record.softOneVersion ?? "",
        ...record.productAreas,
        ...(record.conditions ?? []),
        ...(record.limitations ?? []),
        ...(record.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(
        normalized,
      );
    },
  );
}

export function clearSoftOneEvidenceRegistry():
  void {
  records.clear();
}
