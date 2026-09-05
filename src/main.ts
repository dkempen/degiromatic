import { ConfigurationLoader } from './config';
import { Degiro } from './degiro';
import { getLogger } from './logger';
import { Runner } from './runner';
import { Scheduler } from './scheduler';

const logger = getLogger();
const configuration = new ConfigurationLoader(logger).configuration;
const degiro = new Degiro(logger, configuration);
const runner = new Runner(logger, configuration, degiro);
new Scheduler(logger, configuration, runner);
