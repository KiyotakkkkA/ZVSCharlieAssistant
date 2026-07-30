import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './application/create-main-window'
import {
  registerAppHandlers,
  removeAppHandlers
} from '../ipc/main/register-app-handlers'

app.whenReady().then(() => {
  registerAppHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('before-quit', removeAppHandlers)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
