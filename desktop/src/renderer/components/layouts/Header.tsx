import { Button, Modal, ScrollArea } from "@kiyotakkkka/zvs-uikit-lib";
import { useState } from "react";
import { CogIcon, GlobalSettingsProvider } from "../atoms";
import { GlobalSettingsSidebar } from "../organisms";
import {
  GlobalSettingsAppearanceForm,
  GlobalSettingsProfileForm,
} from "../organisms/forms";

export const Header = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      <GlobalSettingsProvider>
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
            <div className="flex h-full min-h-0">
              <GlobalSettingsSidebar />
              <ScrollArea className="min-w-0 flex-1">
                <div className="p-6">
                  <GlobalSettingsAppearanceForm />
                  <GlobalSettingsProfileForm />
                </div>
              </ScrollArea>
            </div>
          </Modal.Content>
        </Modal>
      </GlobalSettingsProvider>
    </>
  );
};
