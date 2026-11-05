import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { NotificationsService } from '../notifications/notifications.service';
import { PlotsRepository } from '../plots/plots.repository';
import { PrismaService } from '../prisma/prisma.service';
import { ReportRunner } from '../reports/report.runner';
import { ATTEMPTS, QUEUE_NAME } from './jobs.service';
import { ResultPersister } from './result.persister';
import { WorkerClient, WorkerError } from './worker.client';

const DOMAIN_ERRORS = new Set(['NO_OFFLINE_DATA', 'NO_VALID_SCENE', 'NOT_FOUND']);
export const WORKER_FACTORY = 'WORKER_FACTORY';
const iso = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class JobsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('jobs');
  private consumer?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly plots: PlotsRepository,
    private readonly worker: WorkerClient,
    private readonly persister: ResultPersister,
    private readonly notifications: NotificationsService,
    @Inject(WORKER_FACTORY) private readonly makeConsumer: (h: (j: Job) => Promise<void>) => Worker,
    private readonly reports?: ReportRunner,
  ) {}

  onModuleInit() {
    this.consumer = this.makeConsumer((j) => this.handle(j));
  }

  onModuleDestroy() {
    return this.consumer?.close();
  }

  async handle(job: Pick<Job, 'id' | 'name' | 'data' | 'attemptsMade' | 'opts'>): Promise<void> {
    const jobId = String(job.id);
    const { plotId } = job.data as { plotId: string };
    await this.prisma.job.update({ where: { id: jobId }, data: { status: 'running', startedAt: new Date() } });
    try {
      if (job.name === 'report') {
        const result = await this.reports!.run(jobId, plotId);
        await this.prisma.job.update({ where: { id: jobId }, data: { status: 'completed', finishedAt: new Date(), errorCode: null, errorMessage: null, result } });
        return;
      }
      const readAt = new Date();
      const plot = await this.plots.findById(plotId);
      if (!plot) throw new WorkerError('NOT_FOUND', 'Talhão não encontrado');
      const to = new Date();
      const from = new Date(to);
      from.setUTCMonth(from.getUTCMonth() - 6);
      const win = { dateFrom: iso(from), dateTo: iso(to) };
      const res = await this.worker.process({ plotId, plotName: plot.name, geometry: plot.geometry, ...win });
      const newAlerts = await this.persister.persist(plotId, win, res, readAt);
      const validScenes = res.scenes.filter((s) => s.valid).length;
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          errorCode: null,
          errorMessage: null,
          result: { validScenes, discardedScenes: res.scenes.length - validScenes, source: res.source },
        },
      });
      await this.notifications.notifyNew(newAlerts).catch((e) => this.log.error(`notify falhou: ${e}`));
    } catch (e) {
      const err = e instanceof WorkerError ? e : new WorkerError('INTERNAL', 'Erro interno ao processar', 0);
      if (!(e instanceof WorkerError)) this.log.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
      const unrecoverable = DOMAIN_ERRORS.has(err.code);
      const last = job.attemptsMade + 1 >= (job.opts?.attempts ?? ATTEMPTS);
      if (unrecoverable || last) {
        await this.prisma.job.update({
          where: { id: jobId },
          data: { status: 'failed', errorCode: err.code, errorMessage: err.message, finishedAt: new Date() },
        });
      }
      if (unrecoverable) throw new UnrecoverableError(err.message);
      throw e;
    }
  }
}

export const consumerFactory = () => (handler: (j: Job) => Promise<void>) =>
  new Worker(QUEUE_NAME, handler, { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' }, concurrency: 2 });
