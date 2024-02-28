import { AutoBuyer } from "./auto-buyer";
import { ConfigLoader } from "./config-loader";
import { getLogger } from "./logger";
import { Scheduler } from "./scheduler";

const logger = getLogger();
const configLoader = new ConfigLoader(logger);
const autoBuyer = new AutoBuyer(logger, configLoader);
new Scheduler(logger, autoBuyer);
