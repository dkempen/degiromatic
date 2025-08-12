import schedule from 'node-schedule';
import { Logger } from 'winston';
import { Buyer } from './buyer';
import { Configuration } from './config';

export class Scheduler {
  constructor(private logger: Logger, private configuration: Configuration, autoBuyer: Buyer) {
    this.startScheduler(autoBuyer);
    this.buyOnLaunch(autoBuyer);
  }

  private startScheduler(autoBuyer: Buyer) {
    const cron = this.configuration.schedule;
    schedule.scheduleJob(cron, () => autoBuyer.buy());
    this.logger.info(`Started DEGIRO Autobuy with cron schedule "${cron}"`);
  }

  private buyOnLaunch(autoBuyer: Buyer) {
    if (this.configuration.buyOnLaunch) {
      this.logger.warn('Starting DEGIRO Autobuy on launch. Use with caution!');
      autoBuyer.buy();
    }
  }
}
