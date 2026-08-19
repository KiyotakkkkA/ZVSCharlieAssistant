import { makeAutoObservable, runInAction } from "mobx";
import type { UserProfile } from "../../ipc/contracts";
import {
  parseIpcDto,
  upsertUserProfileDtoSchema,
  type UpsertUserProfileInput,
} from "../../shared/dto";

export class UserProfileStore {
  profile: UserProfile | null = null;
  loading = false;
  saving = false;
  initialized = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async bootstrap(force = false) {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    try {
      const profile = await window.desktop.userProfile.get();
      runInAction(() => {
        this.profile = profile;
        this.initialized = true;
      });
    } finally {
      runInAction(() => (this.loading = false));
    }
  }

  async save(input: UpsertUserProfileInput) {
    this.saving = true;
    try {
      const profile = await window.desktop.userProfile.upsert(
        parseIpcDto(upsertUserProfileDtoSchema, input),
      );
      runInAction(() => (this.profile = profile));
    } finally {
      runInAction(() => (this.saving = false));
    }
  }
}

export const userProfileStore = new UserProfileStore();
