import { makeAutoObservable, runInAction } from "mobx";
import type { ApplicationSettings, OnboardingState } from "../../ipc/contracts";
import {
  parseIpcDto,
  updateApplicationSettingsDtoSchema,
} from "../../shared/dto";

export class OnboardingStore {
  settings: ApplicationSettings | null = null;
  loading = false;
  initialized = false;
  guideActive = false;
  activeGuideId: string | null = null;
  guideStepIndex = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async bootstrap(force = false): Promise<void> {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    try {
      let settings = await window.desktop.applicationSettings.get();
      if (settings.onboarding.firstLaunchAt === null) {
        settings = await window.desktop.applicationSettings.update({
          onboarding: { firstLaunchAt: new Date().toISOString() },
        });
      }
      runInAction(() => {
        this.settings = settings;
        if (!settings.onboarding.tourCompleted) {
          this.activeGuideId = "beginning";
          this.guideStepIndex = 0;
          this.guideActive = true;
        }
        this.initialized = true;
      });
    } finally {
      runInAction(() => (this.loading = false));
    }
  }

  private async patch(onboarding: Partial<OnboardingState>): Promise<void> {
    const input = parseIpcDto(updateApplicationSettingsDtoSchema, {
      onboarding,
    });
    const settings = await window.desktop.applicationSettings.update(input);
    runInAction(() => (this.settings = settings));
  }

  startGuide(id: string): void {
    this.activeGuideId = id;
    this.guideStepIndex = 0;
    this.guideActive = true;
  }

  nextGuideStep(): void {
    this.guideStepIndex += 1;
  }

  prevGuideStep(): void {
    this.guideStepIndex = Math.max(0, this.guideStepIndex - 1);
  }

  closeGuide(): void {
    this.guideActive = false;
    this.activeGuideId = null;
    this.guideStepIndex = 0;
  }

  async finishGuide(): Promise<void> {
    const id = this.activeGuideId;
    if (!id) return;
    const completedGuides = this.settings?.onboarding.completedGuides ?? [];
    await this.patch({
      completedGuides: completedGuides.includes(id)
        ? completedGuides
        : [...completedGuides, id],
      ...(id === "beginning" ? { tourCompleted: true } : {}),
    });
    runInAction(() => {
      this.guideActive = false;
      this.activeGuideId = null;
      this.guideStepIndex = 0;
    });
  }

  isGuideCompleted(id: string): boolean {
    return (
      this.settings?.onboarding.completedGuides.includes(id) === true ||
      (id === "beginning" && this.settings?.onboarding.tourCompleted === true)
    );
  }
}

export const onboardingStore = new OnboardingStore();
