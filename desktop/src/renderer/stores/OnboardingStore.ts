import { makeAutoObservable, runInAction } from "mobx";
import type {
  ApplicationSettings,
  OnboardingState,
} from "../../ipc/contracts";
import { automationStore } from "./AutomationStore";
import { chatStore } from "./ChatStore";
import { directoryPolicyStore } from "./DirectoryPolicyStore";
import { secretStorageStore } from "./SecretStorageStore";
import { terminalPolicyStore } from "./TerminalPolicyStore";
import { textProviderStore } from "./TextProviderStore";
import { userProfileStore } from "./UserProfileStore";
import { vectorStoreStore } from "./VectorStoreStore";

export interface OnboardingReadiness {
  textProviderStore: { enabledModels: unknown[] };
  userProfileStore: { profile: { displayName: string } | null };
  directoryPolicyStore: { policy: { grants: unknown[] } | null };
  terminalPolicyStore: {
    policy: { enabled: boolean; allowedCommands: string[] } | null;
  };
  automationStore: {
    agents: unknown[];
    skills: unknown[];
    scenarios: unknown[];
  };
  secretStorageStore: { secrets: unknown[] };
  chatStore: { conversations: unknown[]; messages: unknown[] };
  vectorStoreStore: { stores: unknown[] };
}

const defaultReadiness: OnboardingReadiness = {
  textProviderStore,
  userProfileStore,
  directoryPolicyStore,
  terminalPolicyStore,
  automationStore,
  secretStorageStore,
  chatStore,
  vectorStoreStore,
};

export class OnboardingStore {
  settings: ApplicationSettings | null = null;
  loading = false;
  initialized = false;
  wizardOpen = false;
  guideActive = false;
  activeGuideId: string | null = null;
  guideStepIndex = 0;

  constructor(private readonly readiness: OnboardingReadiness = defaultReadiness) {
    makeAutoObservable<this, "readiness">(
      this,
      { readiness: false },
      { autoBind: true },
    );
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
        this.wizardOpen = !settings.onboarding.wizardCompleted;
        if (
          settings.onboarding.wizardCompleted &&
          !settings.onboarding.tourCompleted
        ) {
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
    const settings = await window.desktop.applicationSettings.update({ onboarding });
    runInAction(() => (this.settings = settings));
  }

  async completeWizard(): Promise<void> {
    await this.patch({ wizardCompleted: true });
    runInAction(() => (this.wizardOpen = false));
  }

  async skipWizard(): Promise<void> {
    await this.completeWizard();
  }

  openWizard(): void {
    this.wizardOpen = true;
  }

  startGuide(id: string): void {
    this.wizardOpen = false;
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

  async setGuideCompleted(id: string, completed: boolean): Promise<void> {
    const current = this.settings?.onboarding.completedGuides ?? [];
    await this.patch({
      completedGuides: completed
        ? [...new Set([...current, id])]
        : current.filter((item) => item !== id),
      ...(id === "beginning" ? { tourCompleted: completed } : {}),
    });
  }

  isGuideCompleted(id: string): boolean {
    return (
      this.settings?.onboarding.completedGuides.includes(id) === true ||
      (id === "beginning" && this.settings?.onboarding.tourCompleted === true)
    );
  }

  async dismissChecklist(): Promise<void> {
    await this.patch({ checklistDismissed: true });
  }

  async restoreChecklist(): Promise<void> {
    await this.patch({ checklistDismissed: false });
  }

  async toggleStep(id: string): Promise<void> {
    const current = this.settings?.onboarding.completedSteps ?? [];
    await this.patch({
      completedSteps: current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    });
  }

  async resetOnboarding(): Promise<void> {
    await this.patch({
      version: 2,
      wizardCompleted: false,
      tourCompleted: false,
      checklistDismissed: false,
      completedSteps: [],
      completedGuides: [],
    });
    runInAction(() => {
      this.wizardOpen = true;
      this.guideActive = false;
      this.activeGuideId = null;
      this.guideStepIndex = 0;
    });
  }

  get hasProvider(): boolean {
    return this.readiness.textProviderStore.enabledModels.length > 0;
  }
  get hasProfile(): boolean {
    return Boolean(this.readiness.userProfileStore.profile?.displayName.trim());
  }
  get hasDirectoryPolicy(): boolean {
    return Boolean(this.readiness.directoryPolicyStore.policy?.grants.length);
  }
  get hasTerminalPolicy(): boolean {
    const policy = this.readiness.terminalPolicyStore.policy;
    return Boolean(policy?.enabled && policy.allowedCommands.length);
  }
  get hasAgent(): boolean {
    return this.readiness.automationStore.agents.length > 0;
  }
  get hasSkill(): boolean {
    return this.readiness.automationStore.skills.length > 0;
  }
  get hasScenario(): boolean {
    return this.readiness.automationStore.scenarios.length > 0;
  }
  get hasSecret(): boolean {
    return this.readiness.secretStorageStore.secrets.length > 0;
  }
  get hasChatMessage(): boolean {
    return (
      this.readiness.chatStore.conversations.length > 0 &&
      this.readiness.chatStore.messages.length > 0
    );
  }
  get hasVectorStore(): boolean {
    return this.readiness.vectorStoreStore.stores.length > 0;
  }
  get checklistProgress(): number {
    const completed = [
      this.hasProvider,
      this.hasProfile,
      this.hasDirectoryPolicy,
      this.hasChatMessage,
      this.hasAgent,
      this.hasScenario,
    ].filter(Boolean).length;
    return completed / 6;
  }
}

export const onboardingStore = new OnboardingStore();
