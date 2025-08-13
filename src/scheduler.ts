import schedule from 'node-schedule';
import { Logger } from 'winston';
import { Buyer } from './buyer';
import { Configuration } from './config';

export class Scheduler {
  constructor(private logger: Logger, private configuration: Configuration, buyer: Buyer) {
    this.buyOnLaunch(buyer);
    this.startScheduler(buyer);
  }

  private startScheduler(buyer: Buyer) {
    const cron = this.configuration.schedule;
    schedule.scheduleJob(cron, () => buyer.buy());
    this.logger.info(`Started DEGIRO Autobuy with cron schedule "${cron}"`);
  }

  private buyOnLaunch(buyer: Buyer) {
    if (this.configuration.buyOnLaunch) {
      this.logger.warn('Starting DEGIRO Autobuy on launch. Use with caution!');
      buyer.buy();
    }
  }
}
