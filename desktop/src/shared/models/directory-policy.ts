import type { DirectoryGrant } from "../dto/directory-policy.dto";

export interface DirectoryPolicy {
  grants: DirectoryGrant[];
  updatedAt: string;
}
