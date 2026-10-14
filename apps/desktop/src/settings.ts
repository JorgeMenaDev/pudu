import * as fs from "node:fs";
import * as path from "node:path";

import { DEFAULT_SETTINGS, type RecorderSettings } from "@pudu/contracts";

// Recorder settings persist as one JSON file in Electron's userData folder.
export class SettingsStore {
  private readonly file: string;

  constructor(userDataDir: string) {
    this.file = path.join(userDataDir, "settings.json");
  }

  load(): RecorderSettings {
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, "utf8")) as Partial<RecorderSettings>;
      return { ...DEFAULT_SETTINGS, ...saved };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  save(settings: RecorderSettings): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(settings, null, 2)}\n`);
  }
}
