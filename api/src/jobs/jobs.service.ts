import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { AppException, notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { JobDto } from './dto';

export const JOBS_QUEUE = 'JOBS_QUEUE';
export const QUEUE_NAME = 'agrosat';
export const ATTEMPTS = 3;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(JOBS_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueue(plotId: string): Promise<string> {
    return (await this.enqueueOrReuse(plotId, false)).jobId;
  }

  async enqueueFarm(farmId: string): Promise<string[]> {
    const plots = await this.prisma.plot.findMany({ where: { farmId }, select: { id: true }, orderBy: { id: 'asc' } });
    const ids: string[] = [];
    for (const p of plots) ids.push((await this.enqueueOrReuse(p.id, true)).jobId);
    return ids;
  }

  private async enqueueOrReuse(plotId: string, reuse: boolean): Promise<{ jobId: string }> {
    const jobId = randomUUID();
    const existing = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM plot WHERE id = ${plotId}::uuid FOR UPDATE`;
      if (!locked.length) throw notFound('Talhão');
      const busy = await tx.job.findFirst({
        where: { plotId, type: 'history', status: { in: ['queued', 'running'] } },
        select: { id: true },
      });
      if (busy) return busy.id;
      await tx.job.create({ data: { id: jobId, type: 'history', plotId } });
      return null;
    });
    if (existing) {
      if (reuse) return { jobId: existing };
      throw new AppException('JOB_IN_PROGRESS', 'Já existe um processamento em andamento para este talhão');
    }
    try {
      await this.queue.add('history', { plotId }, {
        jobId,
        attempts: ATTEMPTS,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
      });
    } catch (e) {
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: 'failed', errorCode: 'QUEUE_UNAVAILABLE', errorMessage: 'Fila indisponível', finishedAt: new Date() },
      });
      throw e;
    }
    return { jobId };
  }

  async get(id: string): Promise<JobDto> {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw notFound('Job');
    return JobDto.from(job);
  }
}
