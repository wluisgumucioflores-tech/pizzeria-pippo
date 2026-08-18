import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListPromotionsQueryDto {
  @ApiPropertyOptional({
    description:
      'Incluir promociones inactivas ("true"/"false"). Por defecto, solo activas.',
  })
  @IsOptional()
  @IsBooleanString()
  showInactive?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'UUID real de la sucursal (no un nombre). Omitir para consultar todas las sucursales del negocio — nunca inventar un valor si no se conoce el UUID real.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description:
      'Fecha ISO (YYYY-MM-DD) para filtrar promociones vigentes en esa fecha.',
  })
  @IsOptional()
  @IsString()
  date?: string;
}
