import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PatchEmployeeDto } from './dto/patch-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  list(@Query() query: ListEmployeesQueryDto, @CurrentUser() user: CurrentUserPayload) {
    return this.employeesService.list(query, user);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: CurrentUserPayload) {
    return this.employeesService.create(dto, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: CurrentUserPayload) {
    return this.employeesService.update(id, dto, user);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: PatchEmployeeDto, @CurrentUser() user: CurrentUserPayload) {
    return this.employeesService.setActive(id, dto.is_active, user);
  }

  @Post(':id/credential')
  regenerateCredential(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.employeesService.regenerateCredential(id, user);
  }
}
