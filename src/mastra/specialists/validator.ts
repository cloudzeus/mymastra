import type {
  CreativeContentArtifact,
  CustomerProposalArtifact,
  MediaGenerationPolicy,
  MediaReferenceAsset,
  UXDesignArtifact,
  SpecialistArtifactEnvelope,
  SpecialistArtifactType,
  SpecialistRole,
} from "./types";


export type SpecialistArtifactValidation = {
  valid: boolean;

  errors: string[];

  warnings: string[];
};


const EXPECTED_ARTIFACT_TYPE_BY_ROLE:
  Record<
    SpecialistRole,
    SpecialistArtifactType
  > = {
    RESEARCH_COMPETITOR:
      "RESEARCH_PACKAGE",

    UI_UX_DESIGNER:
      "UX_DESIGN_PACKAGE",

    COPYWRITER:
      "COPY_PACKAGE",

    SEARCH_VISIBILITY:
      "SEARCH_VISIBILITY_PACKAGE",

    CONTENT_CREATOR:
      "CREATIVE_CONTENT_PACKAGE",

    QUALITY_ASSURANCE:
      "QA_REPORT",

    PROPOSAL_SOLUTIONS_CONSULTANT:
      "CUSTOMER_PROPOSAL_PACKAGE",
  };


function hasText(
  value: string,
): boolean {
  return Boolean(
    value?.trim(),
  );
}


export function validateSpecialistArtifact(
  artifact:
    SpecialistArtifactEnvelope<unknown>,
): SpecialistArtifactValidation {
  const errors:
    string[] =
    [];

  const warnings:
    string[] =
    [];


  if (
    !hasText(
      artifact.id,
    )
  ) {
    errors.push(
      "artifact.id is required",
    );
  }


  if (
    !Number.isInteger(
      artifact.version,
    ) ||
    artifact.version <
      1
  ) {
    errors.push(
      "artifact.version must be a positive integer",
    );
  }


  const ownership =
    artifact as unknown as {
      scope?: unknown;
      customerId?: unknown;
      opportunityId?: unknown;
      projectId?: unknown;
    };


  if (
    typeof ownership.customerId !== "string" ||
    hasText(
      ownership.customerId,
    ) === false
  ) {
    errors.push(
      "artifact.customerId is required",
    );
  }


  if (
    ownership.scope ===
      "OPPORTUNITY"
  ) {
    if (
      typeof ownership.opportunityId !== "string" ||
      hasText(
        ownership.opportunityId,
      ) === false
    ) {
      errors.push(
        "OPPORTUNITY artifact requires artifact.opportunityId",
      );
    }


    if (
      ownership.projectId !== undefined
    ) {
      errors.push(
        "OPPORTUNITY artifact must not define artifact.projectId",
      );
    }
  } else if (
    ownership.scope ===
      "PROJECT"
  ) {
    if (
      typeof ownership.projectId !== "string" ||
      hasText(
        ownership.projectId,
      ) === false
    ) {
      errors.push(
        "PROJECT artifact requires artifact.projectId",
      );
    }


    if (
      ownership.opportunityId !== undefined &&
      (
        typeof ownership.opportunityId !== "string" ||
        hasText(
          ownership.opportunityId,
        ) === false
      )
    ) {
      errors.push(
        "PROJECT artifact.opportunityId must be a non-blank string when provided",
      );
    }
  } else {
    errors.push(
      "artifact.scope must be OPPORTUNITY or PROJECT",
    );
  }


  if (
    !hasText(
      artifact.tenantId,
    )
  ) {
    errors.push(
      "artifact.tenantId is required",
    );
  }


  if (
    !hasText(
      artifact.tenantCode,
    )
  ) {
    errors.push(
      "artifact.tenantCode is required",
    );
  }


  if (
    !hasText(
      artifact.title,
    )
  ) {
    errors.push(
      "artifact.title is required",
    );
  }


  if (
    !hasText(
      artifact.objective,
    )
  ) {
    errors.push(
      "artifact.objective is required",
    );
  }


  const expectedArtifactType =
    EXPECTED_ARTIFACT_TYPE_BY_ROLE[
      artifact.role
    ];


  if (
    artifact.artifactType !==
      expectedArtifactType
  ) {
    errors.push(
      `Artifact role ${artifact.role} requires artifact type ${expectedArtifactType}`,
    );
  }


  if (
    artifact.status ===
      "READY"
  ) {
    const requiredUnresolved =
      artifact.unresolved.filter(
        (
          item,
        ) =>
          item.requiredForCompletion,
      );


    if (
      requiredUnresolved.length >
      0
    ) {
      errors.push(
        "READY artifact cannot contain unresolved items required for completion",
      );
    }


    if (
      artifact.blockers.length >
      0
    ) {
      errors.push(
        "READY artifact cannot contain blockers",
      );
    }
  }


  for (
    const finding
    of artifact.findings
  ) {
    if (
      finding.evidence ===
        "VERIFIED" &&
      finding.sourceIds.length ===
        0
    ) {
      errors.push(
        `VERIFIED finding ${finding.id} requires sourceIds`,
      );
    }
  }


  for (
    const recommendation
    of artifact.recommendations
  ) {
    if (
      recommendation.evidence ===
        "VERIFIED" &&
      recommendation.sourceIds.length ===
        0
    ) {
      errors.push(
        `VERIFIED recommendation ${recommendation.id} requires sourceIds`,
      );
    }
  }


  if (
    artifact.provenance.length ===
      0
  ) {
    warnings.push(
      "artifact has no provenance",
    );
  }


  return {
    valid:
      errors.length ===
      0,

    errors,

    warnings,
  };
}



function validateMediaReferences(
  references:
    MediaReferenceAsset[],
  context:
    string,
  errors:
    string[],
): void {
  if (
    !Array.isArray(
      references,
    )
  ) {
    errors.push(
      `${context}.referenceAssets must be an array`,
    );

    return;
  }


  for (
    const reference
    of references
  ) {
    if (
      !hasText(
        reference.assetId,
      )
    ) {
      errors.push(
        `${context} contains a reference asset without assetId`,
      );
    }


    if (
      !Array.isArray(
        reference.preservationRequirements,
      )
    ) {
      errors.push(
        `${context} reference ${reference.assetId || "<unknown>"} preservationRequirements must be an array`,
      );
    }
  }
}


function validateNonNegativeNumber(
  value:
    number | undefined,
  field:
    string,
  errors:
    string[],
): void {
  if (
    value ===
      undefined
  ) {
    return;
  }


  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value,
    ) ||
    value <
      0
  ) {
    errors.push(
      `${field} must be a non-negative finite number`,
    );
  }
}


function validatePositiveInteger(
  value:
    number,
  field:
    string,
  errors:
    string[],
): void {
  if (
    !Number.isInteger(
      value,
    ) ||
    value <
      1
  ) {
    errors.push(
      `${field} must be a positive integer`,
    );
  }
}


function validateMediaGenerationPolicy(
  policy:
    MediaGenerationPolicy | undefined,
  context:
    string,
  errors:
    string[],
): void {
  if (
    policy ===
      undefined
  ) {
    return;
  }


  validatePositiveInteger(
    policy.maxImageVariantsPerRequest,
    `${context}.maxImageVariantsPerRequest`,
    errors,
  );

  validatePositiveInteger(
    policy.maxVideoVariantsPerRequest,
    `${context}.maxVideoVariantsPerRequest`,
    errors,
  );


  if (
    typeof policy.maxVideoDurationSeconds !==
      "number" ||
    !Number.isFinite(
      policy.maxVideoDurationSeconds,
    ) ||
    policy.maxVideoDurationSeconds <=
      0
  ) {
    errors.push(
      `${context}.maxVideoDurationSeconds must be a positive finite number`,
    );
  }


  validateNonNegativeNumber(
    policy.maxCostPerImageUsd,
    `${context}.maxCostPerImageUsd`,
    errors,
  );

  validateNonNegativeNumber(
    policy.maxCostPerVideoUsd,
    `${context}.maxCostPerVideoUsd`,
    errors,
  );

  validateNonNegativeNumber(
    policy.autonomousSpendLimitUsd,
    `${context}.autonomousSpendLimitUsd`,
    errors,
  );

  validateNonNegativeNumber(
    policy.approvalRequiredAboveUsd,
    `${context}.approvalRequiredAboveUsd`,
    errors,
  );

  validateNonNegativeNumber(
    policy.projectBudgetUsd,
    `${context}.projectBudgetUsd`,
    errors,
  );

  validateNonNegativeNumber(
    policy.tenantDailyBudgetUsd,
    `${context}.tenantDailyBudgetUsd`,
    errors,
  );

  validateNonNegativeNumber(
    policy.tenantMonthlyBudgetUsd,
    `${context}.tenantMonthlyBudgetUsd`,
    errors,
  );


  if (
    Number.isFinite(
      policy.autonomousSpendLimitUsd,
    ) &&
    Number.isFinite(
      policy.approvalRequiredAboveUsd,
    ) &&
    policy.approvalRequiredAboveUsd <
      policy.autonomousSpendLimitUsd
  ) {
    errors.push(
      `${context}.approvalRequiredAboveUsd must be greater than or equal to autonomousSpendLimitUsd`,
    );
  }
}


export function validateUXDesignArtifact(
  artifact:
    UXDesignArtifact,
): SpecialistArtifactValidation {
  const base =
    validateSpecialistArtifact(
      artifact,
    );

  const errors =
    [
      ...base.errors,
    ];

  const warnings =
    [
      ...base.warnings,
    ];


  if (
    artifact.role !==
      "UI_UX_DESIGNER"
  ) {
    errors.push(
      "UX design artifact must use UI_UX_DESIGNER role",
    );
  }


  if (
    artifact.artifactType !==
      "UX_DESIGN_PACKAGE"
  ) {
    errors.push(
      "UX design artifact must use UX_DESIGN_PACKAGE type",
    );
  }


  const ux =
    artifact.payload;


  if (
    !Array.isArray(
      ux.customerAssets,
    )
  ) {
    errors.push(
      "UXDesignPackage.customerAssets must be an array",
    );
  } else {
    for (
      const asset
      of ux.customerAssets
    ) {
      if (
        !hasText(
          asset.assetId,
        )
      ) {
        errors.push(
          "UXDesignPackage.customerAssets contains an asset without assetId",
        );
      }


      if (
        asset.scope ===
          "CUSTOMER" &&
        asset.reusableAcrossProjects ===
          false
      ) {
        warnings.push(
          `Customer-scoped asset ${asset.assetId || "<unknown>"} is not marked reusableAcrossProjects`,
        );
      }
    }
  }


  for (
    const page
    of ux.pages
  ) {
    if (
      !hasText(
        page.id,
      )
    ) {
      errors.push(
        "UXDesignPackage.pages contains a page without id",
      );
    }
  }


  for (
    const component
    of ux.components
  ) {
    if (
      !hasText(
        component.id,
      )
    ) {
      errors.push(
        "UXDesignPackage.components contains a component without id",
      );
    }
  }


  for (
    const image
    of ux.imageCreativeRequirements
  ) {
    if (
      !hasText(
        image.id,
      )
    ) {
      errors.push(
        "UXDesignPackage.imageCreativeRequirements contains an item without id",
      );
    }


    validateMediaReferences(
      image.referenceAssets,
      `UX image creative ${image.id || "<unknown>"}`,
      errors,
    );
  }


  for (
    const video
    of ux.videoCreativeRequirements
  ) {
    if (
      !hasText(
        video.id,
      )
    ) {
      errors.push(
        "UXDesignPackage.videoCreativeRequirements contains an item without id",
      );
    }


    if (
      video.durationSeconds !==
        undefined &&
      (
        !Number.isFinite(
          video.durationSeconds,
        ) ||
        video.durationSeconds <=
          0
      )
    ) {
      errors.push(
        `UX video creative ${video.id || "<unknown>"} durationSeconds must be positive when provided`,
      );
    }


    validateMediaReferences(
      video.referenceAssets,
      `UX video creative ${video.id || "<unknown>"}`,
      errors,
    );
  }


  validateMediaGenerationPolicy(
    ux.mediaGenerationPolicy,
    "UXDesignPackage.mediaGenerationPolicy",
    errors,
  );


  return {
    valid:
      errors.length ===
      0,
    errors,
    warnings,
  };
}


export function validateCreativeContentArtifact(
  artifact:
    CreativeContentArtifact,
): SpecialistArtifactValidation {
  const base =
    validateSpecialistArtifact(
      artifact,
    );

  const errors =
    [
      ...base.errors,
    ];

  const warnings =
    [
      ...base.warnings,
    ];


  if (
    artifact.role !==
      "CONTENT_CREATOR"
  ) {
    errors.push(
      "Creative content artifact must use CONTENT_CREATOR role",
    );
  }


  if (
    artifact.artifactType !==
      "CREATIVE_CONTENT_PACKAGE"
  ) {
    errors.push(
      "Creative content artifact must use CREATIVE_CONTENT_PACKAGE type",
    );
  }


  const creative =
    artifact.payload;


  if (
    !Array.isArray(
      creative.customerAssets,
    )
  ) {
    errors.push(
      "CreativeContentPackage.customerAssets must be an array",
    );
  } else {
    for (
      const asset
      of creative.customerAssets
    ) {
      if (
        !hasText(
          asset.assetId,
        )
      ) {
        errors.push(
          "CreativeContentPackage.customerAssets contains an asset without assetId",
        );
      }


      if (
        asset.scope ===
          "CUSTOMER" &&
        asset.reusableAcrossProjects ===
          false
      ) {
        warnings.push(
          `Customer-scoped asset ${asset.assetId || "<unknown>"} is not marked reusableAcrossProjects`,
        );
      }
    }
  }


  for (
    const image
    of creative.imageCreatives
  ) {
    if (
      !hasText(
        image.id,
      )
    ) {
      errors.push(
        "CreativeContentPackage.imageCreatives contains an item without id",
      );
    }


    validateMediaReferences(
      image.referenceAssets,
      `Creative image ${image.id || "<unknown>"}`,
      errors,
    );
  }


  for (
    const video
    of creative.videoCreatives
  ) {
    if (
      !hasText(
        video.id,
      )
    ) {
      errors.push(
        "CreativeContentPackage.videoCreatives contains an item without id",
      );
    }


    if (
      video.durationSeconds !==
        undefined &&
      (
        !Number.isFinite(
          video.durationSeconds,
        ) ||
        video.durationSeconds <=
          0
      )
    ) {
      errors.push(
        `Creative video ${video.id || "<unknown>"} durationSeconds must be positive when provided`,
      );
    }


    validateMediaReferences(
      video.referenceAssets,
      `Creative video ${video.id || "<unknown>"}`,
      errors,
    );
  }


  for (
    const variant
    of creative.creativeVariants
  ) {
    if (
      !hasText(
        variant.id,
      )
    ) {
      errors.push(
        "CreativeContentPackage.creativeVariants contains a variant without id",
      );
    }


    if (
      !hasText(
        variant.sourceCreativeId,
      )
    ) {
      errors.push(
        `Creative variant ${variant.id || "<unknown>"} requires sourceCreativeId`,
      );
    }


    if (
      variant.durationSeconds !==
        undefined &&
      (
        !Number.isFinite(
          variant.durationSeconds,
        ) ||
        variant.durationSeconds <=
          0
      )
    ) {
      errors.push(
        `Creative variant ${variant.id || "<unknown>"} durationSeconds must be positive when provided`,
      );
    }
  }


  validateMediaGenerationPolicy(
    creative.mediaGenerationPolicy,
    "CreativeContentPackage.mediaGenerationPolicy",
    errors,
  );


  return {
    valid:
      errors.length ===
      0,
    errors,
    warnings,
  };
}


export function validateCustomerProposalArtifact(
  artifact:
    CustomerProposalArtifact,
): SpecialistArtifactValidation {
  const base =
    validateSpecialistArtifact(
      artifact,
    );


  const errors =
    [
      ...base.errors,
    ];

  const warnings =
    [
      ...base.warnings,
    ];


  if (
    artifact.role !==
      "PROPOSAL_SOLUTIONS_CONSULTANT"
  ) {
    errors.push(
      "Customer proposal artifact must use PROPOSAL_SOLUTIONS_CONSULTANT role",
    );
  }


  if (
    artifact.artifactType !==
      "CUSTOMER_PROPOSAL_PACKAGE"
  ) {
    errors.push(
      "Customer proposal artifact must use CUSTOMER_PROPOSAL_PACKAGE type",
    );
  }


  const proposal =
    artifact.payload;


  if (
    proposal.pricingStatus ===
      "VERIFIED"
  ) {
    if (
      proposal.commercialLines.length ===
        0
    ) {
      errors.push(
        "VERIFIED pricing requires at least one commercial line",
      );
    }


    for (
      const line
      of proposal.commercialLines
    ) {
      if (
        line.sourceIds.length ===
          0
      ) {
        errors.push(
          `Commercial line ${line.id} requires sourceIds when pricing is VERIFIED`,
        );
      }
    }
  }


  if (
    proposal.pricingStatus ===
      "UNRESOLVED" &&
    proposal.commercialLines.some(
      (
        line,
      ) =>
        line.unitPrice !==
          undefined ||
        line.totalPrice !==
          undefined,
    )
  ) {
    errors.push(
      "UNRESOLVED pricing must not contain numeric price values",
    );
  }


  if (
    proposal.mode ===
      "COMMERCIAL_PROPOSAL" &&
    proposal.pricingStatus ===
      "UNRESOLVED"
  ) {
    warnings.push(
      "Commercial proposal has unresolved pricing",
    );
  }


  return {
    valid:
      errors.length ===
      0,

    errors,

    warnings,
  };
}
