import { Button, Dropdown, Modal } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { APP_PATHS, NAVIGATION_ROUTES, type NavigationRoute } from "../../app/routes";
import type { AppInfo } from "../../../ipc/contracts";
import { chatStore, onboardingStore, uiStore } from "../../stores";
import {
  CogIcon,
  QuestionIcon,
  GlobalSettingsProvider,
  useGlobalSettings,
  type GlobalSettingsFormDescriptor,
} from "../atoms";
import { GlobalSettingsPanel } from "../organisms";
import {
  APPEARANCE_ANCHORS,
  APPEARANCE_SECTION,
  APPLICATION_ANCHORS,
  APPLICATION_SECTION,
  GlobalSettingsApplicationForm,
  GlobalSettingsAppearanceForm,
  GlobalSettingsProfileForm,
  PROFILE_ANCHORS,
  PROFILE_SECTION,
  DATA_ANCHORS,
  DATA_SECTION,
  GlobalSettingsDataForm,
} from "../organisms/forms";

const SETTINGS_FORMS: GlobalSettingsFormDescriptor[] = [
  {
    ...PROFILE_SECTION,
    anchors: Object.values(PROFILE_ANCHORS),
    Component: GlobalSettingsProfileForm,
  },
  {
    ...APPEARANCE_SECTION,
    anchors: Object.values(APPEARANCE_ANCHORS),
    Component: GlobalSettingsAppearanceForm,
  },
  {
    ...APPLICATION_SECTION,
    anchors: Object.values(APPLICATION_ANCHORS),
    Component: GlobalSettingsApplicationForm,
  },
  {
    ...DATA_SECTION,
    anchors: Object.values(DATA_ANCHORS),
    Component: GlobalSettingsDataForm,
  },
];

function findTitle(pathname: string, routes: readonly NavigationRoute[]): string {
  for (const route of routes) {
    if (route.path && (route.path === "/" ? pathname === "/" : pathname.startsWith(route.path))) return route.label;
    const child = route.children && findTitle(pathname, route.children);
    if (child) return child;
  }
  return "ZVS Assistant";
}

const SettingsAnchorBridge = observer(function SettingsAnchorBridge() {
  const { navigate } = useGlobalSettings();
  useEffect(() => {
    if (!uiStore.settingsOpen || !uiStore.settingsAnchor) return;
    navigate(uiStore.settingsAnchor);
    uiStore.consumeSettingsAnchor();
  }, [navigate, uiStore.settingsOpen, uiStore.settingsAnchor]);
  return null;
});

export const Header = observer(function Header() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(
    () =>
      window.desktop.subscribeToCommands((command) => {
        switch (command) {
          case "new-chat":
            chatStore.newConversation();
            navigate(APP_PATHS.chat);
            break;
          case "open-tasks":
            navigate(APP_PATHS.tasks);
            break;
          case "open-scenarios":
            navigate(APP_PATHS.automation.scenarios.index);
            break;
          case "open-settings":
            uiStore.openSettings();
            break;
          case "start-onboarding":
            onboardingStore.openWizard();
            break;
          case "open-home":
            navigate(APP_PATHS.home);
            break;
        }
      }),
    [navigate],
  );
  return (
    <>
      <header className="flex h-11 items-center justify-between gap-3 rounded-lg bg-main-800/40 px-3">
        <h1 className="text-sm font-medium text-main-200">{findTitle(pathname, NAVIGATION_ROUTES)}</h1>
        <div className="flex items-center gap-1">
          <Dropdown menuPlacement="bottom-right" menuWidth={230}>
            <Dropdown.Trigger data-tour="header-help" rounded="rounded-lg" className="size-9! justify-center! border-0! p-0! text-main-400 shadow-none ring-0! hover:bg-main-700/70 hover:text-main-50" aria-label="Справка"><QuestionIcon className="size-5" /></Dropdown.Trigger>
            <Dropdown.Menu rounded="rounded-xl" className="p-1.5">
              <Dropdown.Item onClick={onboardingStore.startTour}>Интерактивный тур</Dropdown.Item>
              <Dropdown.Item onClick={() => { void onboardingStore.restoreChecklist(); navigate(APP_PATHS.home); }}>Первые шаги</Dropdown.Item>
              <Dropdown.Item onClick={onboardingStore.openWizard}>Мастер настройки</Dropdown.Item>
              <Dropdown.Item onClick={() => void window.desktop.getAppInfo().then(setAppInfo)}>О приложении</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button
            data-tour="header-settings"
            variant="ghost"
            title="Глобальные настройки"
            className="size-9 p-0 text-main-400 hover:bg-main-700/70 hover:text-main-50"
            onClick={() => uiStore.openSettings()}
          >
            <CogIcon className="size-5" />
          </Button>
        </div>
      </header>
      <GlobalSettingsProvider forms={SETTINGS_FORMS}>
        <SettingsAnchorBridge />
        <Modal
          open={uiStore.settingsOpen}
          rounded="rounded-3xl"
          className="h-[min(48rem,84vh)] max-w-6xl overflow-hidden"
          onClose={uiStore.closeSettings}
          closeOnOverlayClick={false}
        >
          <Modal.Header>
            <div>
              <h2 className="text-base font-semibold text-main-50">
                Настройки
              </h2>
            </div>
          </Modal.Header>
          <Modal.Content className="min-h-0 p-0!">
            <GlobalSettingsPanel />
          </Modal.Content>
        </Modal>
      </GlobalSettingsProvider>
      <Modal open={appInfo !== null} onClose={() => setAppInfo(null)} className="max-w-md" rounded="rounded-3xl">
        <Modal.Header><h2 className="text-base font-semibold text-main-50">О приложении</h2></Modal.Header>
        <Modal.Content>{appInfo ? <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt className="text-main-500">Название</dt><dd className="text-main-200">{appInfo.name}</dd><dt className="text-main-500">Версия</dt><dd className="text-main-200">{appInfo.version}</dd><dt className="text-main-500">Платформа</dt><dd className="text-main-200">{appInfo.platform}</dd></dl> : null}</Modal.Content>
      </Modal>
    </>
  );
});
