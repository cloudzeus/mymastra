import type {
  CustomerProposalArtifact,
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

    VIDEO_CONTENT_CREATOR:
      "VIDEO_CONTENT_PACKAGE",

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
