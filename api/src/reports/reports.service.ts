import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { AppException, notFound } from '../common/errors';
import { ATTEMPTS, JOBS_QUEUE } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';

const filesUrl = (rel: string) => `${(process.env.PUBLIC_FILES_URL ?? 'http://localhost:3001/api/v1/files').replace(/\/$/, '')}/${rel}`;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(JOBS_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueue(plotId: string): Promise<string> {
    if (!(await this.prisma.plot.findUnique({ where: { id: plotId }, select: { id: true } }))) throw notFound('Talhão');
    if (!(await this.prisma.ndviScene.count({ where: { plotId, valid: true, pngPath: { not: null } } }))) {
      throw new AppException('NO_VALID_SCENE', 'Talhão sem cena válida para gerar relatório');
    }
    const jobId = randomUUID();
    await this.prisma.job.create({ data: { id: jobId, type: 'report', plotId } });
    try {
      await this.queue.add('report', { plotId }, { jobId, attempts: ATTEMPTS, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 });
    } catch (e) {
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: 'failed', errorCode: 'QUEUE_UNAVAILABLE', errorMessage: 'Fila indisponível', finishedAt: new Date() },
      });
      throw e;
    }
    return jobId;
  }

  async latest(plotId: string) {
    const r = await this.prisma.report.findFirst({ where: { plotId }, orderBy: { generatedAt: 'desc' } });
    if (!r) throw notFound('Relatório');
    return { id: r.id, generatedAt: r.generatedAt, pdfUrl: filesUrl(r.pdfPath) };
  }
}
