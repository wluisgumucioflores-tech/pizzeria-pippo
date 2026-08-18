import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ToggleActiveBusinessDto } from './dto/toggle-active-business.dto';

// Solo el superadmin de la plataforma administra negocios — un admin de
// comercio no tiene por qué ver ni tocar este endpoint.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@ApiTags('businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  list() {
    return this.businessesService.list();
  }

  @Post()
  create(@Body() dto: CreateBusinessDto) {
    return this.businessesService.create(dto);
  }

  @Patch(':id')
  setActive(@Param('id') id: string, @Body() dto: ToggleActiveBusinessDto) {
    return this.businessesService.setActive(id, dto.is_active);
  }
}
