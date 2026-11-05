import { Job } from '@prisma/client';

export class JobDto {
  id: string;
  type: string;
  plotId: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  result: unknown;
  startedAt: Date | null;
  finishedAt: Date | null;

  static from(j: Job): JobDto {
    const { id, type, plotId, status, errorCode, errorMessage, result, startedAt, finishedAt } = j;
    return Object.assign(new JobDto(), { id, type, plotId, status, errorCode, errorMessage, result, startedAt, finishedAt });
  }
}
