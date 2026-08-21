export type PresalesRepositoryWorkspaceStatus =
  | "PENDING"
  | "PROVISIONING"
  | "READY"
  | "BLOCKED";


export type PresalesRepositoryWorkspace = {
  presalesSourceId: string;

  tenantId: string;
  customerId: string;
  opportunityId: string;

  workspacePath: string;

  requestedRef?: string;

  resolvedRef?: string;
  resolvedCommit?: string;

  status:
    PresalesRepositoryWorkspaceStatus;

  createdAt: string;
  updatedAt: string;
};
