import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import { CashboxService } from './cashbox.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { CurrentSessionQueryDto } from './dto/current-session-query.dto';
import { ListCashSessionsQueryDto } from './dto/list-cash-sessions-query.dto';

// Abrir/registrar gasto/cerrar están disponibles a cualquier rol autenticado
// con el módulo habilitado (cajero y admin usan el POS por igual) — el
// historial (listSessions, para Reportes → Caja) sí es admin-only.
@UseGuards(JwtAuthGuard)
@Controller('cashbox')
export class CashboxController {
  constructor(private readonly cashboxService: CashboxService) {}

  @Get('sessions/current')
  getCurrent(
    @Query() query: CurrentSessionQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.cashboxService.getCurrentSession(query.branchId, user);
  }

  @Post('sessions')
  open(@Body() dto: OpenSessionDto, @CurrentUser() user: CurrentUserPayload) {
    return this.cashboxService.openSession(dto, user);
  }

  @Post('sessions/:id/expenses')
  addExpense(
    @Param('id') id: string,
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.cashboxService.createExpense(id, dto, user);
  }

  @Post('sessions/:id/close')
  close(
    @Param('id') id: string,
    @Body() dto: CloseSessionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.cashboxService.closeSession(id, dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('sessions')
  list(
    @Query() query: ListCashSessionsQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.cashboxService.listSessions(query, user);
  }
}
