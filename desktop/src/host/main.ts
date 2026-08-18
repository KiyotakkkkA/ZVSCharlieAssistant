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

app.whenReady().then(() => {
  installContentSecurityPolicy();
  database = createSqliteDatabase(join(app.getPath("userData"), "storage.db"));
  const secretRepository = new SecretStorageRepository(database);
  secretRepository.encryptLegacySecrets();
  textExtraction = new TextExtractionClient();
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
    textExtraction,
  );
  registerVectorStoreHandlers(vectorService);
  const providerRegistry = new ProviderRegistry(
    chatRepository,
    secretRepository,
  );
  const scenarioExecutions = new ScenarioExecutionRepository(database);
  scenarioExecutions.recoverInterruptedRuns();
  const integrationRepository = new IntegrationRepository(database);
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
  const memoryService = new MemoryService(new MemoryRepository(database));
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
  );
  registerTerminalPolicyHandlers(
    terminalPolicyRepository,
    commandExecutionService,
  );
  registerDirectoryPolicyHandlers(directoryPolicyRepository);
  const scenarioGraphs = new ScenarioGraphRepository(database);
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
  registerChatHandlers(
    chatRepository,
    new RunEngine(
      chatRepository,
      providerRegistry,
      toolRegistry,
      memoryService,
      scenarioRuntimeEngine,
    ),
  );
  registerCoreInteractorHandlers(new CoreInteractorService());
  registerAssistantHandlers(memoryService, taskPlans, questionService);

  createMainWindow();
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
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("before-quit", () => {
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
  removeAutomationHandlers();
  removeTextProviderHandlers();
  removeChatHandlers();
  removeVectorStoreHandlers();
  removeTaskHandlers();
  removeCoreInteractorHandlers();
  removeTerminalPolicyHandlers();
  removeDirectoryPolicyHandlers();
  removeIntegrationHandlers();
  removeAssistantHandlers();
  if (engineLogger) disposeLogger(engineLogger);
  engineLogger = undefined;
  database?.close();
  database = undefined;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
