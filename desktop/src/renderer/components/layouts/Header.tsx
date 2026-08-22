import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_PATHS } from "../../app/routes";
import { chatStore } from "../../stores";
import {
  CogIcon,
  GlobalSettingsProvider,
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

export const Header = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();

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
            setSettingsOpen(true);
            break;
        }
      }),
    [navigate],
  );
  return (
    <>
      <header className="flex h-11 items-center justify-between gap-3 rounded-lg bg-main-800/40 px-3">
        Header
        <div>
          <Button
            variant="ghost"
            title="Глобальные настройки"
            className="text-main-400 hover:bg-main-700/70 hover:text-main-50"
            onClick={() => setSettingsOpen(true)}
          >
            <CogIcon />
          </Button>
        </div>
      </header>
      <GlobalSettingsProvider forms={SETTINGS_FORMS}>
        <Modal
          open={settingsOpen}
          rounded="rounded-3xl"
          className="h-[min(48rem,84vh)] max-w-6xl overflow-hidden"
          onClose={() => setSettingsOpen(false)}
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
    </>
  );
};
