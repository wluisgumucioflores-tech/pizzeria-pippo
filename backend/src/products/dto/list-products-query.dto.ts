import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ListProductsQueryDto {
  @ApiPropertyOptional({
    description:
      'Incluir productos inactivos ("true"/"false"). Por defecto, solo activos.',
  })
  @IsOptional()
  @IsBooleanString()
  showInactive?: string;

  @ApiPropertyOptional({
    description: 'Número de página, empieza en 1.',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por página.',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @ApiPropertyOptional({
    description: 'Texto libre para buscar por nombre de producto.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Categoría del producto: "pizza", "bebida" u "otro".',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
