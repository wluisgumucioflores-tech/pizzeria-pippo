import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TelegramChatsService } from './telegram-chats.service';
import { CreateAuthorizedChatDto } from './dto/create-authorized-chat.dto';
import { UpdateAuthorizedChatDto } from './dto/update-authorized-chat.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiTags('telegram')
@Controller('telegram/chats')
export class TelegramChatsController {
  constructor(private readonly telegramChatsService: TelegramChatsService) {}

  @Get()
  list() {
    return this.telegramChatsService.list();
  }

  @Post()
  create(@Body() dto: CreateAuthorizedChatDto) {
    return this.telegramChatsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAuthorizedChatDto) {
    return this.telegramChatsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.telegramChatsService.remove(id);
  }
}
