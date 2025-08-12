import { Buyer } from './buyer';
import { ConfigurationLoader } from './config';
import { Degiro } from './degiro';
import { getLogger } from './logger';
import { Scheduler } from './scheduler';

const logger = getLogger();
const configuration = new ConfigurationLoader(logger).configuration;
const degiro = new Degiro(logger, configuration);
const buyer = new Buyer(logger, configuration, degiro);
new Scheduler(logger, configuration, buyer);
