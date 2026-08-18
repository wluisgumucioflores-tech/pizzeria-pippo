import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.devicesService.list(user);
  }

  @Post()
  create(@Body() dto: CreateDeviceDto, @CurrentUser() user: CurrentUserPayload) {
    return this.devicesService.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeviceDto, @CurrentUser() user: CurrentUserPayload) {
    return this.devicesService.update(id, dto, user);
  }
}
