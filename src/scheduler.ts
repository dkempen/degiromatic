import schedule from 'node-schedule';
import { Logger } from 'pino';
import { Buyer } from './buyer';
import { Configuration } from './config';

export class Scheduler {
  constructor(private logger: Logger, private configuration: Configuration, private buyer: Buyer) {
    this.gracefulShutdown();
    this.runOnLaunch();
    this.startScheduler();
  }

  private startScheduler() {
    const cron = this.configuration.schedule;
    schedule.scheduleJob(cron, () => this.buy());
    this.logger.info(`Started DEGIROmatic scheduler with cron schedule "${cron}"`);
  }

  private runOnLaunch() {
    if (this.configuration.runOnLaunch) {
      this.logger.warn('Starting DEGIROmatic on launch. Use with caution!');
      this.buy();
    }
  }

  private gracefulShutdown() {
    process.on('SIGTERM', async () => {
      await schedule.gracefulShutdown();
      process.exit(0);
    });
  }

  private async buy() {
    const successful = await this.buyer.buy();
    if (successful) {
      this.logger.info('DEGIROmatic run finished!\n');
    } else {
      this.logger.error('DEGIROmatic could not finish this run\n');
    }
  }
}
