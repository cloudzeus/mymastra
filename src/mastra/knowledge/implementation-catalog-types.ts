export type ImplementationRepositoryStatus =
  | "PENDING"
  | "SCANNING"
  | "READY"
  | "FAILED"
  | "IGNORED";


export type ImplementationReuseMode =
  | "REUSE_AS_IS"
  | "ADAPT"
  | "REFERENCE_ONLY"
  | "NOT_SUITABLE";


export type ImplementationAdminStatus =
  | "CANDIDATE"
  | "APPROVED"
  | "REFERENCE_ONLY"
  | "IGNORED";


export type ImplementationRepository = {
  id: string;

  provider: "GITHUB";

  owner: string;

  repositoryName: string;

  repositoryUrl: string;

  defaultBranch?: string;

  scannedCommit?: string;

  status:
    ImplementationRepositoryStatus;

  detectedStack: string[];

  summary?: string;

  lastScannedAt?: string;

  createdAt: string;

  updatedAt: string;
};


export type ImplementationCandidate = {
  id: string;

  repositoryId: string;

  name: string;

  category: string;

  problemSolved: string;

  description?: string;

  tags: string[];

  technologies: string[];

  sourceFiles: string[];

  dependencies: string[];

  customerSpecificDependencies:
    string[];

  reusableParts: string[];

  nonReusableParts: string[];

  reuseGuidance: string[];

  reuseMode:
    ImplementationReuseMode;

  scores: {
    completeness: number;

    isolation: number;

    production: number;

    portability: number;

    maintainability: number;

    overall: number;
  };

  confidence: number;

  adminStatus:
    ImplementationAdminStatus;

  adminNotes?: string;

  createdAt: string;

  updatedAt: string;
};


export type ImplementationCapability = {
  id: string;

  name: string;

  description?: string;

  category: string;

  tags: string[];

  preferredCandidateId?: string;

  status:
    "ACTIVE" | "DEPRECATED";

  createdAt: string;

  updatedAt: string;
};


export type ImplementationSecurityStatus =
  | "UNKNOWN"
  | "PASS"
  | "WARNING"
  | "BLOCKED";


export type MinedImplementationCandidate = {
  name: string;

  category: string;

  problemSolved: string;

  description?: string;

  tags: string[];

  technologies: string[];

  sourceFiles: string[];

  dependencies: string[];

  customerSpecificDependencies: string[];

  reusableParts: string[];

  nonReusableParts: string[];

  reuseGuidance: string[];

  reuseMode:
    ImplementationReuseMode;

  scores: {
    completeness: number;
    isolation: number;
    production: number;
    portability: number;
    maintainability: number;
  };

  confidence: number;
};
