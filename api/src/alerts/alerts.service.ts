import { Injectable } from '@nestjs/common';
import { Paginated, PaginationDto, paginate } from '../common/pagination.dto';
import { AlertRow, AlertsRepository } from './alerts.repository';
import { AlertsQuery } from './alerts.controller';

@Injectable()
export class AlertsService {
  constructor(private readonly repo: AlertsRepository) {}

  async list(q: AlertsQuery): Promise<Paginated<AlertRow>> {
    const { rows, total } = await this.repo.list(q, q.page, q.pageSize);
    return paginate(rows, q as PaginationDto, total);
  }
}
