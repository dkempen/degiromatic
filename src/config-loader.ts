import dotenv from "dotenv";
import fs from "fs";
import { Logger } from "winston";
import { Config } from "./config";
import { CONFIG_FILE } from "./constants";
import { exitProcess, getConfigDirectory } from "./util";

export class ConfigLoader {
  config!: Config;

  constructor(private logger: Logger) {
    this.loadEnvironmentVariables();
    this.loadConfig();
  }

  private loadEnvironmentVariables() {
    dotenv.config();
  }

  private loadConfig() {
    try {
      const raw = fs.readFileSync(getConfigDirectory() + CONFIG_FILE, "utf8");
      this.config = JSON.parse(raw);
      // TODO: Validate required properties
    } catch (e) {
      exitProcess(this.logger, e);
    }
  }
}
