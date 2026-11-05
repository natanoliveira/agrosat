import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateFarmDto {
  @Transform(trim)
  @IsString({ message: 'name deve ser texto' })
  @IsNotEmpty({ message: 'name é obrigatório' })
  @MaxLength(200, { message: 'name deve ter no máximo 200 caracteres' })
  name: string;

  @Transform(trim)
  @IsString({ message: 'municipality deve ser texto' })
  @IsNotEmpty({ message: 'municipality é obrigatório' })
  @MaxLength(200, { message: 'municipality deve ter no máximo 200 caracteres' })
  municipality: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'state deve ter exatamente 2 letras' })
  state: string;
}

export class UpdateFarmDto extends PartialType(CreateFarmDto) {}

export class FarmDto {
  id: string;
  name: string;
  municipality: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
  plotCount?: number;

  static from(f: FarmDto & { _count?: { plots: number } }): FarmDto {
    const { id, name, municipality, state, createdAt, updatedAt, _count } = f;
    return Object.assign(new FarmDto(), { id, name, municipality, state, createdAt, updatedAt }, _count && { plotCount: _count.plots });
  }
}
