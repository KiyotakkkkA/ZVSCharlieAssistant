import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { createMainWindow } from "./infrastructure/electron/create-main-window";
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
import { ScenarioCompiler } from "./infrastructure/automation/scenario-compiler";
import { ScenarioRunEngine } from "./infrastructure/automation/scenario-run-engine";
import { ScenarioExecutionRepository } from "./infrastructure/database/scenario-execution.repository";
import { ToolRegistry } from "./infrastructure/tools/tool.registry";
import { OllamaWebService } from "./infrastructure/tools/ollama-web.service";
import {
  registerChatHandlers,
  removeChatHandlers,
} from "../ipc/main/register-chat-handlers";
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
import {
  registerDirectoryPolicyHandlers,
  removeDirectoryPolicyHandlers,
} from "../ipc/main/register-directory-policy-handlers";
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

let database: ReturnType<typeof createSqliteDatabase> | undefined;
let scenarioJobWorker: ScenarioJobWorker | undefined;
let intervalScheduleWorker: IntervalScheduleWorker | undefined;
let telegramWatchListener: TelegramWatchListener | undefined;
let mailWatchListener: MailWatchListener | undefined;
let scenarioFileDownloads: ScenarioFileDownloadService | undefined;

app.whenReady().then(() => {
  database = createSqliteDatabase(join(app.getPath("userData"), "storage.db"));
  const secretRepository = new SecretStorageRepository(database);
  const terminalPolicyRepository = new TerminalPolicyRepository(database);
  const directoryPolicyRepository = new DirectoryPolicyRepository(database);
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
  registerAppHandlers(new ElectronGeneratedArtifactExporter(reportsRoot));
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
  );
  registerVectorStoreHandlers(vectorService);
  const providerRegistry = new ProviderRegistry(
    chatRepository,
    secretRepository,
  );
  const scenarioExecutions = new ScenarioExecutionRepository(database);
  scenarioExecutions.recoverInterruptedRuns();
  const integrationRepository = new IntegrationRepository(database);
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
  const ollamaWebService = new OllamaWebService(
    automationRepository,
    secretRepository,
  );
  const commandExecutionService = new CommandExecutionService(
    terminalPolicyRepository,
    directoryPolicyRepository,
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
  );
  registerTerminalPolicyHandlers(
    terminalPolicyRepository,
    commandExecutionService,
  );
  registerDirectoryPolicyHandlers(directoryPolicyRepository);
  const scenarioEngine = new ScenarioRunEngine(
    scenarioExecutions,
    providerRegistry,
    new ScenarioCompiler(),
    vectorService,
    toolRegistry,
    integrationRepository,
    scenarioFileDownloads,
    new ScenarioFileReaderService(scenarioDownloadsRoot),
  );
  registerAutomationHandlers(
    automationRepository,
    scenarioExecutions,
    scenarioEngine,
    integrationRepository,
  );
  registerChatHandlers(
    chatRepository,
    new RunEngine(
      chatRepository,
      providerRegistry,
      toolRegistry,
      scenarioEngine,
    ),
  );
  registerCoreInteractorHandlers(new CoreInteractorService());
  createMainWindow();
  const automationJobs = new AutomationJobRepository(database);
  scenarioJobWorker = new ScenarioJobWorker(automationJobs, scenarioEngine);
  intervalScheduleWorker = new IntervalScheduleWorker(
    automationJobs,
    integrationRepository,
  );
  telegramWatchListener = new TelegramWatchListener(
    integrationRepository,
    automationJobs,
    secretRepository,
  );
  mailWatchListener = new MailWatchListener(
    integrationRepository,
    automationJobs,
    secretRepository,
  );
  scenarioJobWorker.start();
  intervalScheduleWorker.start();
  telegramWatchListener.start();
  mailWatchListener.start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("before-quit", () => {
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
  removeAutomationHandlers();
  removeTextProviderHandlers();
  removeChatHandlers();
  removeVectorStoreHandlers();
  removeTaskHandlers();
  removeCoreInteractorHandlers();
  removeTerminalPolicyHandlers();
  removeDirectoryPolicyHandlers();
  removeIntegrationHandlers();
  database?.close();
  database = undefined;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
