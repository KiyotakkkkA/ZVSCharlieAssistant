import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { createMainWindow } from "./application/create-main-window";
import {
  registerAppHandlers,
  removeAppHandlers,
} from "../ipc/main/register-app-handlers";
import {
  registerSecretStorageHandlers,
  removeSecretStorageHandlers,
} from "../ipc/main/register-secret-storage-handlers";
import { createSqliteDatabase } from "./infrastructure/database/sqlite.database";
import { SecretStorageDataSource } from "./infrastructure/database/secret-storage.data-source";
import { SqliteSecretStorageRepository } from "./infrastructure/repositories/sqlite-secret-storage.repository";
import {
  registerAutomationHandlers,
  removeAutomationHandlers,
} from "../ipc/main/register-automation-handlers";
import { AutomationDataSource } from "./infrastructure/database/automation.data-source";
import { SqliteAutomationRepository } from "./infrastructure/repositories/sqlite-automation.repository";
import { BUILTIN_AUTOMATION_TOOLS } from "./infrastructure/automation/builtin-tools.registry";
import { ProviderConnectionService } from "./infrastructure/text-generation/provider-connection.service";
import { TextProviderDataSource } from "./infrastructure/database/text-provider.data-source";
import { ChatDataSource } from "./infrastructure/database/chat.data-source";
import { ProviderRegistry } from "./infrastructure/text-generation/provider.registry";
import { RunEngine } from "./infrastructure/text-generation/run-engine";
import { ScenarioCompiler } from "./infrastructure/automation/scenario-compiler";
import { ScenarioRunEngine } from "./infrastructure/automation/scenario-run-engine";
import { ScenarioExecutionDataSource } from "./infrastructure/database/scenario-execution.data-source";
import { ToolRegistry } from "./infrastructure/tools/tool.registry";
import {
  registerChatHandlers,
  removeChatHandlers,
} from "../ipc/main/register-chat-handlers";
import {
  registerTextProviderHandlers,
  removeTextProviderHandlers,
} from "../ipc/main/register-text-provider-handlers";

let database: ReturnType<typeof createSqliteDatabase> | undefined;

app.whenReady().then(() => {
  database = createSqliteDatabase(join(app.getPath("userData"), "storage.db"));
  const secretRepository = new SqliteSecretStorageRepository(
    new SecretStorageDataSource(database),
  );
  const automationDataSource = new AutomationDataSource(database);
  const automationRepository = new SqliteAutomationRepository(
    automationDataSource,
    BUILTIN_AUTOMATION_TOOLS,
  );

  registerAppHandlers();
  registerSecretStorageHandlers(secretRepository);
  const providerDataSource = new TextProviderDataSource(database);
  registerTextProviderHandlers(
    new ProviderConnectionService(secretRepository, providerDataSource),
  );
  const chatDataSource = new ChatDataSource(database);
  const providerRegistry = new ProviderRegistry(chatDataSource, secretRepository);
  const scenarioExecutions = new ScenarioExecutionDataSource(database);
  const scenarioEngine = new ScenarioRunEngine(scenarioExecutions, providerRegistry, new ScenarioCompiler());
  registerAutomationHandlers(
    automationRepository,
    scenarioExecutions,
    scenarioEngine,
  );
  registerChatHandlers(
    chatDataSource,
    new RunEngine(
      chatDataSource,
      providerRegistry,
      new ToolRegistry(chatDataSource, automationDataSource, secretRepository),
      scenarioEngine,
    ),
  );
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("before-quit", () => {
  removeAppHandlers();
  removeSecretStorageHandlers();
  removeAutomationHandlers();
  removeTextProviderHandlers();
  removeChatHandlers();
  database?.close();
  database = undefined;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
