import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PaginationDto {
  @Type(() => Number)
  @IsInt({ message: 'page deve ser um inteiro' })
  @Min(1, { message: 'page deve ser no mínimo 1' })
  page: number = 1;

  @Type(() => Number)
  @IsInt({ message: 'pageSize deve ser um inteiro' })
  @Min(1, { message: 'pageSize deve ser no mínimo 1' })
  @Max(100, { message: 'pageSize deve ser no máximo 100' })
  pageSize: number = 20;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export const paginate = <T>(data: T[], { page, pageSize }: PaginationDto, total: number): Paginated<T> => ({
  data,
  meta: { page, pageSize, total },
});
