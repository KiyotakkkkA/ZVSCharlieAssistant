import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const RESET_MARKER_FILE = ".reset-data-requested";
const PROCESS_LOCK_ENTRIES = new Set([
  "lockfile",
  "singletoncookie",
  "singletonlock",
  "singletonsocket",
]);

export class ApplicationDataResetService {
  private readonly root: string;
  private readonly marker: string;

  constructor(userDataPath: string) {
    this.root = resolve(userDataPath);
    this.marker = this.childPath(RESET_MARKER_FILE);
  }

  requestReset(): void {
    mkdirSync(this.root, { recursive: true });
    writeFileSync(this.marker, new Date().toISOString(), "utf8");
  }

  applyPendingReset(): boolean {
    if (!existsSync(this.marker)) return false;

    for (const entry of readdirSync(this.root)) {
      if (
        entry === RESET_MARKER_FILE ||
        PROCESS_LOCK_ENTRIES.has(entry.toLowerCase())
      )
        continue;
      rmSync(this.childPath(entry), { recursive: true, force: true });
    }
    rmSync(this.marker, { force: true });
    return true;
  }

  private childPath(name: string): string {
    const target = resolve(join(this.root, name));
    const pathFromRoot = relative(this.root, target);
    if (
      !pathFromRoot ||
      pathFromRoot.startsWith("..") ||
      isAbsolute(pathFromRoot)
    ) {
      throw new Error("Refusing to reset data outside the application folder");
    }
    return target;
  }
}
