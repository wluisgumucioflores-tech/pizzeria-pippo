import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { McpKeysService } from './mcp-keys.service';
import { CreateMcpKeyDto } from './dto/create-mcp-key.dto';
import { UpdateMcpKeyDto } from './dto/update-mcp-key.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('mcp/keys')
export class McpKeysController {
  constructor(private readonly mcpKeysService: McpKeysService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.mcpKeysService.list(user);
  }

  @Post()
  create(@Body() dto: CreateMcpKeyDto, @CurrentUser() user: CurrentUserPayload) {
    return this.mcpKeysService.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMcpKeyDto, @CurrentUser() user: CurrentUserPayload) {
    return this.mcpKeysService.update(id, dto, user);
  }
}
