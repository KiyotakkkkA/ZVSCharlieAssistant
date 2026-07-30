import type { ComponentType } from "react";
import { Icon, type IconProps } from "./Icon";

export type SvgIcon = ComponentType<IconProps>;

export const HomeIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="m3 11 9-8 9 8" />
    <path d="M5 10v11h14V10" />
    <path d="M9 21v-7h6v7" />
  </Icon>
);
export const ChatIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
  </Icon>
);
export const TasksIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="m8 12 2 2 5-5" />
  </Icon>
);
export const StorageIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </Icon>
);
export const SettingsIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.4.6.8 1 1 .3.2.7.3 1.1.3h.1v4h-.1c-.4 0-.8.1-1.1.3-.4.1-.8.5-1 .9Z" />
  </Icon>
);
export const SearchIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Icon>
);
export const PlusIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const CloseIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);
export const MenuIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);
export const ChevronLeftIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);
export const ChevronRightIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);
export const ChevronDownIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const BellIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
  </Icon>
);
export const UserIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
);
export const FolderIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </Icon>
);
export const FileIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M6 2h8l4 4v16H6Z" />
    <path d="M14 2v5h5" />
  </Icon>
);
export const DownloadIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />
  </Icon>
);
export const UploadIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M12 15V3m-5 5 5-5 5 5M5 21h14" />
  </Icon>
);
export const TrashIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
  </Icon>
);
export const EditIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M12 20H5a1 1 0 0 1-1-1v-7L15 1l4 4L8 16l-4 1" />
    <path d="m13 3 4 4" />
  </Icon>
);
export const SaveIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M4 3h14l2 2v16H4Z" />
    <path d="M8 3v6h8V3M8 21v-7h8v7" />
  </Icon>
);
export const RefreshIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M20 6v5h-5M4 18v-5h5" />
    <path d="M18 9a7 7 0 0 0-12-2L4 11M6 15a7 7 0 0 0 12 2l2-4" />
  </Icon>
);
export const MoreIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
  </Icon>
);
export const LogoutIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" />
  </Icon>
);
export const LockIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
);
export const EyeIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const SendIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </Icon>
);
export const PaperclipIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.9-2.8L15 5.7" />
  </Icon>
);
export const CalendarIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </Icon>
);
export const ClockIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
export const InfoIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7h.01" />
  </Icon>
);
export const WarningIcon: SvgIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3 2 21h20Z" />
    <path d="M12 9v5M12 18h.01" />
  </Icon>
);
