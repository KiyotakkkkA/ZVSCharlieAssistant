import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createMainWindow } from './application/create-main-window'
import {
  registerAppHandlers,
  removeAppHandlers
} from '../ipc/main/register-app-handlers'
import {
  registerSecretStorageHandlers,
  removeSecretStorageHandlers
} from '../ipc/main/register-secret-storage-handlers'
import { createSqliteDatabase } from './infrastructure/database/sqlite.database'
import { SecretStorageDataSource } from './infrastructure/database/secret-storage.data-source'
import { SqliteSecretStorageRepository } from './infrastructure/repositories/sqlite-secret-storage.repository'

let database: ReturnType<typeof createSqliteDatabase> | undefined

app.whenReady().then(() => {
  database = createSqliteDatabase(join(app.getPath('userData'), 'storage.db'))
  const secretRepository = new SqliteSecretStorageRepository(
    new SecretStorageDataSource(database)
  )

  registerAppHandlers()
  registerSecretStorageHandlers(secretRepository)
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('before-quit', () => {
  removeAppHandlers()
  removeSecretStorageHandlers()
  database?.close()
  database = undefined
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
