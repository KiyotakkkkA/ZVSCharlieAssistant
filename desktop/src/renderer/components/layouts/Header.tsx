import { Button, Dropdown, Modal } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type { AppInfo, AppLocation } from "../../../ipc/contracts";
import {
  APP_PATHS,
  NAVIGATION_ROUTES,
  type NavigationRoute,
} from "../../app/routes";
import { chatStore, uiStore } from "../../stores";
import {
  CogIcon,
  FolderIcon,
  InformationIcon,
  OpenInNewIcon,
  QuestionIcon,
  GlobalSettingsProvider,
  useGlobalSettings,
  type GlobalSettingsFormDescriptor,
} from "../atoms";
import { GlobalSettingsPanel } from "../organisms";
import { DownloadsIndicator } from "../molecules";
import {
  APPEARANCE_ANCHORS,
  APPEARANCE_SECTION,
  APPLICATION_ANCHORS,
  APPLICATION_SECTION,
  GlobalSettingsApplicationForm,
  GlobalSettingsNotificationsForm,
  GlobalSettingsAppearanceForm,
  GlobalSettingsProfileForm,
  NOTIFICATIONS_ANCHORS,
  NOTIFICATIONS_SECTION,
  PROFILE_ANCHORS,
  PROFILE_SECTION,
  DATA_ANCHORS,
  DATA_SECTION,
  GlobalSettingsDataForm,
} from "../organisms/forms";
import { useAppNavigation } from "@renderer/hooks";
import { formatPlatform, formatUpdatedAt } from "@renderer/lib/format";

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
    ...NOTIFICATIONS_SECTION,
    anchors: Object.values(NOTIFICATIONS_ANCHORS),
    Component: GlobalSettingsNotificationsForm,
  },
  {
    ...DATA_SECTION,
    anchors: Object.values(DATA_ANCHORS),
    Component: GlobalSettingsDataForm,
  },
];

function findTitle(
  pathname: string,
  routes: readonly NavigationRoute[],
): string {
  if (pathname === APP_PATHS.guides) return "Уроки";
  for (const route of routes) {
    if (route.path && pathname.startsWith(route.path)) return route.label;
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
  const { goTo } = useAppNavigation();
  const { pathname } = useLocation();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  const openAbout = () => {
    setAboutOpen(true);
    if (!appInfo) void window.desktop.getAppInfo().then(setAppInfo);
  };

  const openLocation = (location: AppLocation) => {
    void window.desktop.openAppLocation(location);
  };

  useEffect(
    () =>
      window.desktop.subscribeToCommands((command) => {
        switch (command) {
          case "new-chat":
            chatStore.newConversation();
            goTo(APP_PATHS.chat);
            break;
          case "open-tasks":
            goTo(APP_PATHS.tasks);
            break;
          case "open-scenarios":
            goTo(APP_PATHS.automation.scenarios.index);
            break;
          case "open-settings":
            uiStore.openSettings();
            break;
        }
      }),
    [goTo],
  );
  return (
    <>
      <header className="flex h-11 items-center justify-between gap-3 rounded-lg bg-main-800/40 px-3">
        <h1 className="text-sm font-medium text-main-200">
          {findTitle(pathname, NAVIGATION_ROUTES)}
        </h1>
        <div className="flex items-center gap-1">
          <DownloadsIndicator />
          <Dropdown menuWidth={220} menuPlacement="bottom-right">
            <Dropdown.Trigger
              data-tour="header-help"
              icon={<QuestionIcon className="size-5" />}
              aria-label="Помощь"
              title="Помощь"
              className="size-9! justify-center! gap-0! border-0! bg-transparent px-0! py-0! text-main-400 shadow-none ring-0! hover:bg-main-700/70! hover:text-main-50"
            >
              <span className="sr-only">Помощь</span>
            </Dropdown.Trigger>
            <Dropdown.Menu rounded="rounded-2xl" className="p-1.5">
              <Dropdown.Item
                icon={<QuestionIcon className="size-4" />}
                rounded="rounded-xl"
                onClick={() => goTo(APP_PATHS.guides)}
              >
                Руководства
              </Dropdown.Item>
              <Dropdown.Item
                icon={<InformationIcon className="size-4" />}
                rounded="rounded-xl"
                onClick={openAbout}
              >
                О приложении
              </Dropdown.Item>
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
      <Modal
        open={aboutOpen}
        rounded="rounded-3xl"
        className="max-w-2xl overflow-hidden"
        onClose={() => setAboutOpen(false)}
      >
        <Modal.Header>
          <div>
            <h2 className="text-base font-semibold text-main-50">
              О приложении
            </h2>
            <p className="mt-1 text-xs text-main-500">ZVS Assistant</p>
          </div>
        </Modal.Header>
        <Modal.Content className="space-y-5">
          {appInfo ? (
            <>
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 rounded-2xl bg-main-800/45 p-4 text-sm ring-1 ring-main-700/35">
                <dt className="text-main-400">Версия</dt>
                <dd className="font-medium text-main-100">{appInfo.version}</dd>
                <dt className="text-main-400">Последнее обновление</dt>
                <dd className="font-medium text-main-100">
                  {formatUpdatedAt(appInfo.updatedAt)}
                </dd>
                <dt className="text-main-400">Система</dt>
                <dd className="font-medium text-main-100">
                  {formatPlatform(appInfo.platform)} · {appInfo.arch}
                </dd>
                <dt className="text-main-400">Electron</dt>
              </dl>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-main-500">
                  Расположение
                </h3>
                <div className="space-y-2">
                  <LocationRow
                    label="Установка"
                    path={appInfo.installPath}
                    onOpen={() => openLocation("install")}
                  />
                  <LocationRow
                    label="Пользовательские данные"
                    path={appInfo.userDataPath}
                    onOpen={() => openLocation("userData")}
                  />
                </div>
              </section>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-main-400">
              Загрузка информации…
            </p>
          )}
        </Modal.Content>
      </Modal>
    </>
  );
});

function LocationRow({
  label,
  path,
  onOpen,
}: {
  label: string;
  path: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-main-800/45 p-3 ring-1 ring-main-700/35">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-main-700/45 text-main-300">
        <FolderIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-main-200">{label}</p>
        <p className="mt-1 truncate text-xs text-main-500" title={path}>
          {path}
        </p>
      </div>
      <Button
        variant="ghost"
        label={`Открыть: ${label}`}
        title="Открыть в проводнике"
        className="size-9 shrink-0 p-0 text-main-400 hover:bg-main-700/70 hover:text-main-50"
        onClick={onOpen}
      >
        <OpenInNewIcon className="size-4" />
      </Button>
    </div>
  );
}
