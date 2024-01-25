import schedule from "node-schedule";
import { AutoBuyer } from "./auto-buyer";

console.log("Started auto-buyer!");

const autobuy = new AutoBuyer();
autobuy.buy();

// schedule.scheduleJob("* * * * *", () => autobuy.buy());
