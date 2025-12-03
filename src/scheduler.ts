import { Cron } from 'croner';
import { Logger } from 'pino';
import { Buyer } from './buyer';
import { Configuration } from './config';
import { logError } from './logger';

export class Scheduler {
  private jobs!: Cron[];
  private running = false;

  constructor(private logger: Logger, private configuration: Configuration, private buyer: Buyer) {
    this.gracefulShutdown();
    this.startScheduler();
    this.runOnLaunch();
  }

  private startScheduler() {
    const schedules = this.configuration.schedule.split(';').map((schedule) => schedule.trim());
    const settings = { legacyMode: false, interval: 60 };
    try {
      this.jobs = schedules.map((schedule) => new Cron(schedule, settings, () => this.buy()));
    } catch {
      this.logger.error(`Invalid cron schedule "${this.configuration.schedule}"`);
      process.exit(1);
    }
    this.logger.info(`Started DEGIROmatic with cron schedule "${schedules.join('" and "')}"`);
    this.logNextRunTime();
  }

  private runOnLaunch() {
    if (this.configuration.runOnLaunch) {
      this.logger.warn('Starting DEGIROmatic on launch. Use with caution!');
      this.jobs[0].trigger();
    }
  }

  private gracefulShutdown() {
    ['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((signal) => {
      process.on(signal, async () => {
        this.jobs.forEach((job) => job.stop());
        process.exit(0);
      });
    });
  }

  private async buy() {
    if (this.running) {
      return;
    }

    try {
      this.running = true;
      await this.buyer.buy();
      this.logger.info('DEGIROmatic run finished!\n');
    } catch (error) {
      logError(this.logger, error);
      this.logger.error('DEGIROmatic could not finish this run\n');
    } finally {
      this.running = false;
      this.logNextRunTime();
    }
  }

  private logNextRunTime() {
    const next = new Date(Math.min(...this.jobs.map((job) => job.nextRun()!.getTime())));
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
