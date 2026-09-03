import { Dropdown, Separator, Tooltip } from "@kiyotakkkka/zvs-uikit-lib";
import { useState } from "react";
import type { ZvsIdentity } from "../../../shared/models/zvs-id";
import { AccountOutlineIcon } from "../atoms";
import { DangerModal } from "../organisms/modals";
import { useZvsIdConnection } from "../../hooks/useZvsIdConnection";

interface ZvsProfileCardProps {
  collapsed: boolean;
}

export function ZvsProfileCard({ collapsed }: ZvsProfileCardProps) {
  const { connection, busy, disconnect } = useZvsIdConnection();
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const identity = connection?.identity;

  if (connection?.status !== "connected" || !identity) return null;

  const confirmation = (
    <DangerModal
      open={logoutConfirmationOpen}
      model={identity}
      title="Выйти из ZVS ID?"
      description="Доступ к системам приложения будет приостановлен. Для продолжения работы потребуется снова войти в ZVS ID."
      confirmLabel="Выйти"
      onCancel={() => setLogoutConfirmationOpen(false)}
      onConfirm={async () => {
        await disconnect();
      }}
    />
  );

  if (collapsed) {
    return (
      <>
        <Dropdown menuWidth={240} menuPlacement="top-left">
          <Tooltip label={profileName(identity)} placement="right-center">
            <Dropdown.Trigger
              icon={<AccountOutlineIcon className="size-5" />}
              aria-label={`Профиль: ${profileName(identity)}`}
              title={profileName(identity)}
              className="size-10! justify-center! gap-0! rounded-full! border-0! bg-accent-medium/15 px-0! py-0! text-accent-light shadow-none ring-0! hover:bg-accent-medium/25!"
            >
              <span className="sr-only">{profileName(identity)}</span>
            </Dropdown.Trigger>
          </Tooltip>
          <Dropdown.Menu rounded="rounded-2xl" className="p-2">
            <ProfileDetails identity={identity} />
            <Separator className="my-1 border-main-700/50" />
            <Dropdown.Item
              className="mt-2 text-danger-light"
              icon={<AccountOutlineIcon className="size-4" />}
              rounded="rounded-xl"
              disabled={busy}
              onClick={() => setLogoutConfirmationOpen(true)}
            >
              Выйти из ZVS ID
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        {confirmation}
      </>
    );
  }

  return (
    <>
      <Dropdown className="w-full" menuWidth="auto" menuPlacement="top-left">
        <Dropdown.Trigger
          aria-label={`Открыть профиль: ${profileName(identity)}`}
          title="Профиль ZVS ID"
          className="h-auto! w-full! rounded-xl! border border-main-700/50! bg-main-800/60! p-2.5! text-left shadow-none ring-0! hover:bg-main-700/60! [&>span:first-child]:flex-1 [&>span:first-child]:overflow-visible [&>span:first-child]:whitespace-normal"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-medium/15 text-xs font-semibold text-accent-light">
              {initials(identity)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-main-100">
                {profileName(identity)}
              </span>
              {identity.email ? (
                <span className="block truncate text-[11px] text-main-500">
                  {identity.email}
                </span>
              ) : null}
            </span>
          </span>
        </Dropdown.Trigger>
        <Dropdown.Menu rounded="rounded-2xl" className="p-1.5">
          <Dropdown.Item
            className="text-danger-light"
            icon={<AccountOutlineIcon className="size-4" />}
            rounded="rounded-xl"
            disabled={busy}
            onClick={() => setLogoutConfirmationOpen(true)}
          >
            Выйти из ZVS ID
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      {confirmation}
    </>
  );
}

function ProfileDetails({ identity }: { identity: ZvsIdentity }) {
  return (
    <div className="mb-1 px-2 py-2">
      <p className="truncate text-sm font-medium text-main-100">
        {profileName(identity)}
      </p>
      {identity.email ? (
        <p className="mt-0.5 truncate text-xs text-main-500">
          {identity.email}
        </p>
      ) : null}
    </div>
  );
}

function profileName(identity: ZvsIdentity): string {
  return identity.displayName?.trim() || identity.email || "Аккаунт ZVS ID";
}

function initials(identity: ZvsIdentity): string {
  const parts = profileName(identity)
    .split(/[\s._@-]+/)
    .filter(Boolean);
  const value =
    parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : parts[0]!.slice(0, 2);
  return value.toUpperCase();
}
