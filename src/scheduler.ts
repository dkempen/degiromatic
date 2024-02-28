import schedule from "node-schedule";
import { Logger } from "winston";
import { AutoBuyer } from "./auto-buyer";
import { BUY_ON_LAUNCH_ENV, SCHEDULE_DEFAULT, SCHEDULE_ENV } from "./constants";

export class Scheduler {
  constructor(private logger: Logger, autoBuyer: AutoBuyer) {
    this.startScheduler(autoBuyer);
    this.buyOnLaunch(autoBuyer);
  }

  private startScheduler(autoBuyer: AutoBuyer) {
    const cron = process.env[SCHEDULE_ENV] ?? SCHEDULE_DEFAULT;
    schedule.scheduleJob(cron, () => autoBuyer.buy());

    this.logger.info(`Started DEGIRO Autobuy with cron schedule "${cron}"`);
  }

  private buyOnLaunch(autoBuyer: AutoBuyer) {
    if (process.env[BUY_ON_LAUNCH_ENV] === "true") {
      this.logger.warn("Starting DEGIRO Autobuy on launch. Use with caution!");
      autoBuyer.buy();
    }
  }
}
