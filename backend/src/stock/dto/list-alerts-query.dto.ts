import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListAlertsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'UUID real de la sucursal (no un nombre). Omitir para consultar todas las sucursales del negocio — nunca inventar un valor si no se conoce el UUID real.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
