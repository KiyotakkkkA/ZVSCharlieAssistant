import { app, Menu } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppWindowController } from "./infrastructure/electron/app-window.controller";
import { ApplicationSettingsRepository } from "./infrastructure/electron/application-settings.repository";
import {
  BACKGROUND_LAUNCH_ARGUMENT,
  LoginItemService,
} from "./infrastructure/electron/login-item.service";
import { TrayController } from "./infrastructure/electron/tray.controller";
import {
  registerAppHandlers,
  removeAppHandlers,
} from "../ipc/main/register-app-handlers";
import {
  registerSecretStorageHandlers,
  removeSecretStorageHandlers,
} from "../ipc/main/register-secret-storage-handlers";
import { createSqliteDatabase } from "./infrastructure/database/sqlite.database";
import { SecretStorageRepository } from "./infrastructure/database/secret-storage.repository";
import { DataTransferService } from "./infrastructure/data-transfer/data-transfer.service";
import { ConfigurationTransferRepository } from "./infrastructure/data-transfer/configuration-transfer.repository";
import { ApplicationDataResetService } from "./infrastructure/data-transfer/application-data-reset.service";
import {
  registerDataTransferHandlers,
  removeDataTransferHandlers,
} from "../ipc/main/register-data-transfer-handlers";

import {
  registerAutomationHandlers,
  removeAutomationHandlers,
} from "../ipc/main/register-automation-handlers";
import { AutomationRepository } from "./infrastructure/database/automation.repository";

import { BUILTIN_AUTOMATION_TOOLS } from "./infrastructure/automation/builtin-tools.registry";
import { FileSystemSkillContentStore } from "./infrastructure/filesystem/skill-content.store";
import { ProviderConnectionService } from "./infrastructure/text-generation/provider-connection.service";
import { TextProviderRepository } from "./infrastructure/database/text-provider.repository";
import { ChatRepository } from "./infrastructure/database/chat.repository";
import { ProviderRegistry } from "./infrastructure/text-generation/provider.registry";
import { RunEngine } from "./infrastructure/text-generation/run-engine";
import { ScenarioExecutionRepository } from "./infrastructure/database/scenario-execution.repository";
import { ToolRegistry } from "./infrastructure/tools/tool.registry";
import { OllamaWebService } from "./infrastructure/tools/ollama-web.service";
import {
  registerChatHandlers,
  removeChatHandlers,
} from "../ipc/main/register-chat-handlers";
import { CHAT_IPC_CHANNELS } from "../ipc/contracts";
import {
  registerTextProviderHandlers,
  removeTextProviderHandlers,
} from "../ipc/main/register-text-provider-handlers";
import {
  registerVectorStoreHandlers,
  removeVectorStoreHandlers,
} from "../ipc/main/register-vector-store-handlers";
import { VectorStoreRepository } from "./infrastructure/database/vector-store.repository";
import { EmbeddingService } from "./infrastructure/vector-store/embedding.service";
import { VectorStoreService } from "./infrastructure/vector-store/vector-store.service";
import { ReportDocxService } from "./infrastructure/tools/report-docx.service";
import { BuiltinSkillProvisioner } from "./application/services/builtin-skill-provisioner";
import { DEFAULT_SKILLS } from "../default/skills";
import { ElectronGeneratedArtifactExporter } from "./infrastructure/electron/generated-artifact.exporter";
import {
  registerTaskHandlers,
  removeTaskHandlers,
} from "../ipc/main/register-task-handlers";
import { TaskHistoryRepository } from "./infrastructure/database/task-history.repository";
import { TerminalPolicyRepository } from "./infrastructure/database/terminal-policy.repository";
import { CommandExecutionService } from "./infrastructure/tools/command-execution.service";
import {
  registerTerminalPolicyHandlers,
  removeTerminalPolicyHandlers,
} from "../ipc/main/register-terminal-policy-handlers";
import { NativeSearchService } from "./infrastructure/tools/native-search.service";
import { DirectoryPolicyRepository } from "./infrastructure/database/directory-policy.repository";
import { ProjectManagementService } from "./application/services/project-management.service";
import { FileEditRepository } from "./infrastructure/database/file-edit.repository";
import { PathResolver } from "./infrastructure/filesystem/path-resolver";
import { FileSystemService } from "./infrastructure/filesystem/file-system.service";
import { CompactionService } from "./application/context/compaction.service";
import { ModelFailover } from "./infrastructure/text-generation/model-failover";
import { ProjectRepository } from "./infrastructure/database/project.repository";
import { ProjectContextService } from "./application/services/project-context.service";
import {
  registerProjectHandlers,
  removeProjectHandlers,
} from "../ipc/main/register-project-handlers";
import { LocalBridgeServer } from "./infrastructure/bridge/local-bridge.server";
import { CliInstallerService } from "./infrastructure/extensions/cli-installer.service";
import {
  registerExtensionHandlers,
  removeExtensionHandlers,
} from "../ipc/main/register-extension-handlers";
import {
  registerDirectoryPolicyHandlers,
  removeDirectoryPolicyHandlers,
} from "../ipc/main/register-directory-policy-handlers";
import { UserProfileRepository } from "./infrastructure/database/user-profile.repository";
import { EntityGenerationRepository } from "./infrastructure/database/entity-generation.repository";
import { EntityGenerationService } from "./application/services/entity-generation.service";
import {
  registerEntityGenerationHandlers,
  removeEntityGenerationHandlers,
} from "../ipc/main/register-entity-generation-handlers";
import {
  registerUserProfileHandlers,
  removeUserProfileHandlers,
} from "../ipc/main/register-user-profile-handlers";
import { IntegrationRepository } from "./infrastructure/database/integration.repository";
import { AutomationJobRepository } from "./infrastructure/database/automation-job.repository";
import { IntegrationProfileService } from "./application/services/integration-profile.service";
import {
  registerIntegrationHandlers,
  removeIntegrationHandlers,
} from "../ipc/main/register-integration-handlers";
import { ScenarioJobWorker } from "./infrastructure/automation/background/scenario-job.worker";
import { IntervalScheduleWorker } from "./infrastructure/automation/background/interval-schedule.worker";
import { TelegramWatchListener } from "./infrastructure/automation/background/telegram-watch.listener";
import { MailWatchListener } from "./infrastructure/automation/background/mail-watch.listener";
import {
  registerCoreInteractorHandlers,
  removeCoreInteractorHandlers,
} from "@ipc/main/register-core-interactor-handlers";
import { CoreInteractorService } from "./infrastructure/electron/core-interactor.service";
import { ScenarioFileRepository } from "./infrastructure/database/scenario-file.repository";
import { ScenarioFileDownloadService } from "./infrastructure/automation/scenario-file-download.service";
import { ScenarioFileReaderService } from "./infrastructure/automation/scenario-file-reader.service";
import { ScenarioDeliveryRepository } from "./infrastructure/database/scenario-delivery.repository";
import { ScenarioResponseService } from "./infrastructure/automation/scenario-response.service";
import { ScenarioDeliveryAdapterRegistry } from "./infrastructure/automation/delivery/scenario-delivery.adapter";
import { TelegramDeliveryAdapter } from "./infrastructure/automation/delivery/telegram-delivery.adapter";
import { EmailDeliveryAdapter } from "./infrastructure/automation/delivery/email-delivery.adapter";
import { ScenarioDeliveryWorker } from "./infrastructure/automation/background/scenario-delivery.worker";
import { TextExtractionClient } from "./infrastructure/vector-store/text-extraction.client";
import { installContentSecurityPolicy } from "./infrastructure/electron/install-content-security-policy";
import { MemoryRepository } from "./infrastructure/database/memory.repository";
import { MemoryService } from "./application/services/memory.service";
import { TaskPlanRepository } from "./infrastructure/database/task-plan.repository";
import { UserQuestionRepository } from "./infrastructure/database/user-question.repository";
import { UserQuestionService } from "./application/services/user-question.service";
import { RecentChatSessionsService } from "./application/services/recent-chat-sessions.service";
import {
  registerAssistantHandlers,
  removeAssistantHandlers,
} from "../ipc/main/register-assistant-handlers";
import { ScenarioGraphRepository } from "./infrastructure/database/scenario-graph.repository";
import { SqliteRuntimePersistence } from "./infrastructure/automation/engine/sqlite-runtime-persistence";
import { HostScenarioEngineServices } from "./infrastructure/automation/engine/host-services.adapter";
import { createExecutorMap } from "./infrastructure/automation/engine/executors";
import { ScenarioRuntimeEngine } from "./infrastructure/automation/engine/scenario-runtime-engine";
import {
  createLogger,
  disposeLogger,
  type Logger,
} from "./infrastructure/observability/logger";

let database: ReturnType<typeof createSqliteDatabase> | undefined;
let scenarioJobWorker: ScenarioJobWorker | undefined;
let intervalScheduleWorker: IntervalScheduleWorker | undefined;
let telegramWatchListener: TelegramWatchListener | undefined;
let mailWatchListener: MailWatchListener | undefined;
let scenarioFileDownloads: ScenarioFileDownloadService | undefined;
let scenarioDeliveryWorker: ScenarioDeliveryWorker | undefined;
let textExtraction: TextExtractionClient | undefined;
let questionSweeper: NodeJS.Timeout | undefined;
let engineLogger: Logger | undefined;
let localBridge: LocalBridgeServer | undefined;
const appWindow = new AppWindowController();
let trayController: TrayController | undefined;
const isPrimaryInstance = app.requestSingleInstanceLock();
const applicationDataReset = new ApplicationDataResetService(
  app.getPath("userData"),
);

if (!isPrimaryInstance) app.quit();
else applicationDataReset.applyPendingReset();

app.on("second-instance", (_event, commandLine) => {
  if (commandLine.includes(BACKGROUND_LAUNCH_ARGUMENT)) return;
  if (app.isReady()) {
    appWindow.show();
    return;
  }
  app.once("ready", () => appWindow.show());
});

app.whenReady().then(() => {
  if (!isPrimaryInstance) return;
  installContentSecurityPolicy();
  database = createSqliteDatabase(join(app.getPath("userData"), "storage.db"));
  const secretRepository = new SecretStorageRepository(database);
  secretRepository.encryptLegacySecrets();
  textExtraction = new TextExtractionClient();
  const terminalPolicyRepository = new TerminalPolicyRepository(database);
  const directoryPolicyRepository = new DirectoryPolicyRepository(database);
  const userProfileRepository = new UserProfileRepository(database);
  const skillContent = new FileSystemSkillContentStore(
    join(app.getPath("userData"), "skills"),
  );
  const automationRepository = new AutomationRepository(
    database,
    BUILTIN_AUTOMATION_TOOLS,
    skillContent,
    terminalPolicyRepository,
    directoryPolicyRepository,
  );
  new BuiltinSkillProvisioner(
    automationRepository,
    skillContent,
    DEFAULT_SKILLS,
  ).provision();

  const reportsRoot = join(
    app.getPath("documents"),
    "ZVS Assistant",
    "Reports",
  );
  const applicationSettings = new ApplicationSettingsRepository(
    join(app.getPath("userData"), "application-settings.json"),
  );
  const loginItem = new LoginItemService(app);
  const initialApplicationSettings = applicationSettings.get();
  const launchedInBackground = loginItem.wasLaunchedInBackground(process.argv);
  try {
    loginItem.setEnabled(initialApplicationSettings.launchAtLogin);
  } catch (error) {
    console.error("Failed to synchronize login item", error);
  }
  registerAppHandlers(new ElectronGeneratedArtifactExporter(reportsRoot), {
    get: () => applicationSettings.get(),
    update: (input) => {
      const previous = applicationSettings.get();
      const updated = applicationSettings.update(input);
      if (input.launchAtLogin !== undefined) {
        try {
          loginItem.setEnabled(updated.launchAtLogin);
        } catch (error) {
          applicationSettings.update({
            launchAtLogin: previous.launchAtLogin,
          });
          throw error;
        }
      }
      appWindow.setCloseToTray(
        trayController !== undefined && updated.runInBackground,
      );
      trayController?.refresh();
      return updated;
    },
  });
  registerSecretStorageHandlers(secretRepository);
  const providerRepository = new TextProviderRepository(database);
  registerTextProviderHandlers(
    new ProviderConnectionService(secretRepository, providerRepository),
  );
  const chatRepository = new ChatRepository(database);
  registerTaskHandlers(new TaskHistoryRepository(database));
  const vectorRepository = new VectorStoreRepository(database);
  vectorRepository.recoverInterruptedDocuments();
  const vectorService = new VectorStoreService(
    vectorRepository,
    new EmbeddingService(vectorRepository, secretRepository),
    join(app.getPath("userData"), "vector-files"),
    join(app.getPath("userData"), "lancedb"),
    textExtraction,
  );
  registerVectorStoreHandlers(vectorService);
  const providerRegistry = new ProviderRegistry(
    chatRepository,
    secretRepository,
  );
  const entityGenerations = new EntityGenerationRepository(database);
  entityGenerations.recoverInterrupted();
  registerEntityGenerationHandlers(
    new EntityGenerationService(
      entityGenerations,
      automationRepository,
      providerRegistry,
      BUILTIN_AUTOMATION_TOOLS,
    ),
  );
  const scenarioExecutions = new ScenarioExecutionRepository(database);
  scenarioExecutions.recoverInterruptedRuns();
  const integrationRepository = new IntegrationRepository(database);
  const scenarioGraphs = new ScenarioGraphRepository(database);
  const scenarioDeliveries = new ScenarioDeliveryRepository(database);
  const scenarioDownloadsRoot = join(app.getPath("userData"), "downloads");
  scenarioFileDownloads = new ScenarioFileDownloadService(
    new ScenarioFileRepository(database),
    integrationRepository,
    secretRepository,
    scenarioDownloadsRoot,
  );
  scenarioFileDownloads.start();
  registerIntegrationHandlers(
    new IntegrationProfileService(integrationRepository, secretRepository),
  );
  const memoryRepository = new MemoryRepository(database);
  const memoryService = new MemoryService(memoryRepository);
  registerDataTransferHandlers(
    new DataTransferService(
      secretRepository,
      terminalPolicyRepository,
      memoryRepository,
      automationRepository,
      new ConfigurationTransferRepository(
        database,
        scenarioGraphs,
        integrationRepository,
      ),
    ),
    () => {
      applicationDataReset.requestReset();
      setTimeout(() => {
        // Трей и фоновые воркеры останавливаются до перезапуска: иначе иконка
        // старого процесса остаётся в области уведомлений, а слушатели почты и
        // Telegram продолжают работать поверх удаляемых данных.
        shutdownRuntime();
        app.relaunch();
        app.quit();
      }, 100);
    },
  );
  const taskPlans = new TaskPlanRepository(database);
  const automationJobs = new AutomationJobRepository(database);
  const questionService = new UserQuestionService(
    new UserQuestionRepository(database),
    integrationRepository,
    secretRepository,
    scenarioDeliveries,
    automationJobs,
  );
  const ollamaWebService = new OllamaWebService(
    automationRepository,
    secretRepository,
  );
  const commandExecutionService = new CommandExecutionService(
    terminalPolicyRepository,
    directoryPolicyRepository,
  );
  const projectRepository = new ProjectRepository(database);
  const projectManagement = new ProjectManagementService(
    projectRepository,
    directoryPolicyRepository,
  );
  const projectContext = new ProjectContextService(projectRepository);
  registerProjectHandlers(projectManagement);
  const fileEditRepository = new FileEditRepository(database);
  const fileSystemService = new FileSystemService(
    new PathResolver(directoryPolicyRepository),
    fileEditRepository,
    join(app.getPath("userData"), "checkpoints"),
  );
  const toolRegistry = new ToolRegistry(
    chatRepository,
    automationRepository,
    ollamaWebService,
    vectorService,
    skillContent,
    new ReportDocxService(reportsRoot),
    commandExecutionService,
    new NativeSearchService(
      join(app.getAppPath(), "native"),
      directoryPolicyRepository,
    ),
    memoryService,
    taskPlans,
    questionService,
    fileSystemService,
    chatRepository,
  );
  registerTerminalPolicyHandlers(
    terminalPolicyRepository,
    commandExecutionService,
  );
  registerDirectoryPolicyHandlers(directoryPolicyRepository);
  registerUserProfileHandlers(userProfileRepository);
  const runtimePersistence = new SqliteRuntimePersistence(
    database,
    join(app.getPath("userData"), "executions"),
  );
  let scenarioRuntimeEngine: ScenarioRuntimeEngine;
  const engineServices = new HostScenarioEngineServices(
    scenarioExecutions,
    providerRegistry,
    toolRegistry,
    vectorService,
    secretRepository,
    scenarioFileDownloads,
    new ScenarioFileReaderService(scenarioDownloadsRoot, textExtraction),
    new ScenarioResponseService(scenarioDeliveries),
    questionService,
    () => scenarioRuntimeEngine,
  );
  engineLogger = createLogger({
    directory: join(app.getPath("userData"), "logs"),
    fileName: "scenario-engine",
  });
  scenarioRuntimeEngine = new ScenarioRuntimeEngine(
    scenarioGraphs,
    scenarioExecutions,
    runtimePersistence,
    engineServices,
    createExecutorMap(engineServices),
    engineLogger,
    questionService,
  );
  registerAutomationHandlers(
    automationRepository,
    scenarioExecutions,
    scenarioGraphs,
    scenarioRuntimeEngine,
    integrationRepository,
    questionService,
  );
  const runEngine = new RunEngine(
    chatRepository,
    providerRegistry,
    toolRegistry,
    memoryService,
    userProfileRepository,
    new CompactionService(chatRepository, providerRegistry),
    new ModelFailover(chatRepository, providerRegistry),
    projectContext,
    scenarioRuntimeEngine,
    vectorService,
    textExtraction,
  );
  registerChatHandlers(
    chatRepository,
    runEngine,
    fileEditRepository,
    fileSystemService,
  );
  localBridge = new LocalBridgeServer({
    userDataPath: app.getPath("userData"),
    appVersion: app.getVersion(),
    chat: chatRepository,
    engine: runEngine,
    projects: projectManagement,
    fileEdits: fileEditRepository,
    files: fileSystemService,
    automation: automationRepository,
    providers: providerRepository,
    questions: questionService,
    recentSessions: new RecentChatSessionsService(
      chatRepository,
      projectRepository,
    ),
    publishChatEvent: (event) => appWindow.send(CHAT_IPC_CHANNELS.event, event),
  });
  localBridge.start();
  registerExtensionHandlers(
    new CliInstallerService(
      app.getPath("userData"),
      process.execPath,
      join(dirname(fileURLToPath(import.meta.url)), "cli.js"),
    ),
  );
  registerCoreInteractorHandlers(new CoreInteractorService());
  registerAssistantHandlers(memoryService, taskPlans, questionService);

  appWindow.create({
    showOnReady: !launchedInBackground,
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Приложение",
        submenu: [{ role: "quit", label: "Выйти" }],
      },
      { role: "editMenu", label: "Правка" },
      { role: "viewMenu", label: "Вид" },
    ]),
  );
  try {
    trayController = new TrayController({
      onOpen: () => appWindow.show(),
      onNewChat: () => appWindow.dispatchCommand("new-chat"),
      onOpenTasks: () => appWindow.dispatchCommand("open-tasks"),
      onOpenScenarios: () => appWindow.dispatchCommand("open-scenarios"),
      onOpenSettings: () => appWindow.dispatchCommand("open-settings"),
      isBackgroundEnabled: () => applicationSettings.get().runInBackground,
      onBackgroundChange: (enabled) => {
        const updated = applicationSettings.update({
          runInBackground: enabled,
        });
        appWindow.setCloseToTray(updated.runInBackground);
      },
      onQuit: () => app.quit(),
    });
    trayController.create();
    appWindow.setCloseToTray(applicationSettings.get().runInBackground);
  } catch (error) {
    trayController = undefined;
    console.error("Failed to initialize Tray", error);
    if (launchedInBackground) appWindow.show();
  }
  scenarioJobWorker = new ScenarioJobWorker(
    automationJobs,
    scenarioRuntimeEngine,
  );
  intervalScheduleWorker = new IntervalScheduleWorker(
    automationJobs,
    integrationRepository,
  );
  telegramWatchListener = new TelegramWatchListener(
    integrationRepository,
    automationJobs,
    secretRepository,
    questionService,
  );
  mailWatchListener = new MailWatchListener(
    integrationRepository,
    automationJobs,
    secretRepository,
    questionService,
  );
  scenarioDeliveryWorker = new ScenarioDeliveryWorker(
    scenarioDeliveries,
    new ScenarioDeliveryAdapterRegistry([
      new TelegramDeliveryAdapter(integrationRepository, secretRepository),
      new EmailDeliveryAdapter(integrationRepository, secretRepository),
    ]),
  );
  scenarioJobWorker.start();
  intervalScheduleWorker.start();
  telegramWatchListener.start();
  mailWatchListener.start();
  scenarioDeliveryWorker.start();
  questionSweeper = setInterval(() => questionService.sweepTimeouts(), 30_000);
  questionSweeper.unref();

  app.on("activate", () => {
    appWindow.show();
  });
});

/**
 * Останавливает всё, что живёт дольше окна: трей, фоновые воркеры, таймеры,
 * IPC-обработчики и базу. Вызывается перед выходом и перед перезапуском
 * после сброса данных. Повторный вызов безопасен.
 */
function shutdownRuntime(): void {
  appWindow.beginQuit();
  appWindow.setCloseToTray(false);
  trayController?.destroy();
  trayController = undefined;
  if (questionSweeper) clearInterval(questionSweeper);
  questionSweeper = undefined;
  textExtraction?.dispose();
  textExtraction = undefined;
  scenarioDeliveryWorker?.stop();
  scenarioDeliveryWorker = undefined;
  intervalScheduleWorker?.stop();
  intervalScheduleWorker = undefined;
  telegramWatchListener?.stop();
  telegramWatchListener = undefined;
  mailWatchListener?.stop();
  mailWatchListener = undefined;
  scenarioJobWorker?.stop();
  scenarioJobWorker = undefined;
  scenarioFileDownloads?.stop();
  scenarioFileDownloads = undefined;
  removeAppHandlers();
  removeSecretStorageHandlers();
  removeDataTransferHandlers();
  removeAutomationHandlers();
  removeTextProviderHandlers();
  localBridge?.stop();
  localBridge = undefined;
  removeChatHandlers();
  removeProjectHandlers();
  removeExtensionHandlers();
  removeVectorStoreHandlers();
  removeTaskHandlers();
  removeCoreInteractorHandlers();
  removeTerminalPolicyHandlers();
  removeDirectoryPolicyHandlers();
  removeUserProfileHandlers();
  removeEntityGenerationHandlers();
  removeIntegrationHandlers();
  removeAssistantHandlers();
  if (engineLogger) disposeLogger(engineLogger);
  engineLogger = undefined;
  database?.close();
  database = undefined;
}

app.on("before-quit", () => {
  shutdownRuntime();
});

app.on("window-all-closed", () => {
  if (!appWindow.keepsRunningInBackground()) app.quit();
});
