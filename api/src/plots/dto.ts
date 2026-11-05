import { Transform } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Polygon } from '../common/geo';
import { PlotRow } from './plots.repository';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePlotDto {
  @Transform(trim)
  @IsString({ message: 'name deve ser texto' })
  @IsNotEmpty({ message: 'name é obrigatório' })
  @MaxLength(200, { message: 'name deve ter no máximo 200 caracteres' })
  name: string;

  @IsObject({ message: 'geometry deve ser um objeto GeoJSON' })
  geometry: Polygon;
}

export class UpdatePlotDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'name deve ser texto' })
  @IsNotEmpty({ message: 'name não pode ser vazio' })
  @MaxLength(200, { message: 'name deve ter no máximo 200 caracteres' })
  name?: string;

  @IsOptional()
  @IsObject({ message: 'geometry deve ser um objeto GeoJSON' })
  geometry?: Polygon;
}

export interface PlotFeature {
  type: 'Feature';
  id: string;
  geometry: Polygon;
  properties: { id: string; farmId: string; name: string; areaHa: number; needsReprocess: boolean };
}

export const toFeature = (r: PlotRow): PlotFeature => ({
  type: 'Feature',
  id: r.id,
  geometry: r.geometry,
  properties: { id: r.id, farmId: r.farmId, name: r.name, areaHa: r.areaHa, needsReprocess: r.needsReprocess },
});
