import type { UserProfile } from "../../shared/models/user-profile";
import type { UpsertUserProfileInput } from "../../shared/dto";

export type * from "../../shared/models/user-profile";

export interface UserProfileApi {
  get(): Promise<UserProfile>;
  upsert(input: UpsertUserProfileInput): Promise<UserProfile>;
}

export const USER_PROFILE_IPC_CHANNELS = {
  get: "user-profile:get",
  upsert: "user-profile:upsert",
} as const;
