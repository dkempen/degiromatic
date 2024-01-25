import dotenv from "dotenv";
import schedule from "node-schedule";
import { AutoBuyer } from "./auto-buyer";

dotenv.config();

const autoBuyer = new AutoBuyer();
autoBuyer.buy();

const cron = process.env["DEGIRO_SCHEDULE"] ?? "0 12 1 * *";
schedule.scheduleJob(cron, () => autoBuyer.buy());

console.log(`Started DEGIRO Autobuy with cron schedule "${cron}"`);
