import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ToggleBanUserDto } from './dto/toggle-ban-user.dto';

// Fixes a security gap from the old Next.js routes: there it only checked
// "is authenticated", not that it was an admin. Here RolesGuard('admin')
// applies to every endpoint, no exceptions.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.list(user);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.create(dto, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.update(id, dto, user);
  }

  @Patch(':id')
  toggleBan(@Param('id') id: string, @Body() dto: ToggleBanUserDto, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.toggleBan(id, dto.ban, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.remove(id, user);
  }
}
