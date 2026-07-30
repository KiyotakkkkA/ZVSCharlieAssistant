import { ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type AppInfo,
  type DesktopApi
} from '../contracts'

export const desktopApi: DesktopApi = {
  getAppInfo: (): Promise<AppInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.getAppInfo) as Promise<AppInfo>
}
