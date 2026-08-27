import type { DirectoryGrant } from "../dto";

export interface Project {
  id: string;
  name: string;
  rootPath: string | null;
  instructions: string;
  defaultAgentId: string | null;
  defaultModelId: string | null;
  compactThreshold: number;
  compactModelId: string | null;
  archived: boolean;
  grants: DirectoryGrant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRepositoryState {
  branch: string | null;
  dirtyFiles: number;
  ahead: number;
  behind: number;
}

export interface ProjectSnapshot {
  projects: Project[];
}
