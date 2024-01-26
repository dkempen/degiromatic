import dotenv from "dotenv";
import schedule from "node-schedule";
import { AutoBuyer } from "./auto-buyer";
import { BUY_ON_LAUNCH, DEGIRO_SCHEDULE_DEFAULT, SCHEDULE } from "./constants";

dotenv.config();

const autoBuyer = new AutoBuyer();

const cron = process.env[SCHEDULE] ?? DEGIRO_SCHEDULE_DEFAULT;
schedule.scheduleJob(cron, () => autoBuyer.buy());

console.log(`Started DEGIRO Autobuy with cron schedule "${cron}"`);

if (process.env[BUY_ON_LAUNCH] === "true") {
  console.warn("Starting DEGIRO Autobuy on launch. Use with caution!");
  autoBuyer.buy();
}
