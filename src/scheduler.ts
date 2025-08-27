import { Cron } from 'croner';
import { Logger } from 'pino';
import { Buyer } from './buyer';
import { Configuration } from './config';
import { logError } from './util';

export class Scheduler {
  private job!: Cron;

  constructor(private logger: Logger, private configuration: Configuration, private buyer: Buyer) {
    this.gracefulShutdown();
    this.startScheduler();
    this.runOnLaunch();
  }

  private startScheduler() {
    const cron = this.configuration.schedule;
    this.job = new Cron(cron, () => this.buy());
    this.logger.info(`Started DEGIROmatic with cron schedule "${cron}"`);
    this.logNextRunTime();
  }

  private runOnLaunch() {
    if (this.configuration.runOnLaunch) {
      this.logger.warn('Starting DEGIROmatic on launch. Use with caution!');
      this.job.trigger();
    }
  }

  private gracefulShutdown() {
    ['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((signal) => {
      process.on(signal, async () => {
        this.job.stop();
        process.exit(0);
      });
    });
  }

  private async buy() {
    let successful = false;
    try {
      successful = await this.buyer.buy();
    } catch (error) {
      logError(this.logger, error);
    }
    if (successful) {
      this.logger.info('DEGIROmatic run finished!\n');
    } else {
      this.logger.error('DEGIROmatic could not finish this run\n');
    }
    this.logNextRunTime();
  }

  private logNextRunTime() {
    const next = this.job.nextRun()!;
    const date =
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-` +
      `${String(next.getDate()).padStart(2, '0')} ${String(next.getHours()).padStart(2, '0')}:` +
      `${String(next.getMinutes()).padStart(2, '0')}:${String(next.getSeconds()).padStart(2, '0')}`;

    let difference = Math.floor((next.getTime() - new Date().getTime()) / 1000);
    if (difference < 0) difference = 0;

    const days = Math.floor(difference / (24 * 3600));
    const hours = Math.floor((difference % (24 * 3600)) / 3600);
    const minutes = Math.floor((difference % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    if (parts.length === 0) parts.push('less than a minute');

    const relative = `in ${parts.join(', ')}`;

    this.logger.info(`Next run at ${date} (${relative})`);
  }
}
