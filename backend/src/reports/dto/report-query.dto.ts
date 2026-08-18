import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ReportQueryDto {
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
      'Fecha ISO (YYYY-MM-DD) de inicio del rango. Por defecto, hoy.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Fecha ISO (YYYY-MM-DD) de fin del rango. Por defecto, hoy.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
