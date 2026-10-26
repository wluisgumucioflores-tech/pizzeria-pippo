import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PublicOnlineOrdersService } from './public-online-orders.service';
import { CreatePublicOrderDto } from './dto/create-public-order.dto';

// PUBLIC CONTROLLER — no JwtAuthGuard, on purpose. Anyone who scans the QR
// reaches this without an account (see docs/features/pedidos-online-qr/).
// Same mechanism the existing public-menu controller already uses for the
// marketing landing, but this one also WRITES, which is new for this codebase.
//
// Because of that, every handler here is rate limited per IP and the service
// re-checks the branch, the business and the onlineOrders module on every
// single call — there is no session to lean on.
//
// Do NOT add authenticated endpoints to this file. The management side lives
// in its own guarded controller.
@UseGuards(ThrottlerGuard)
@Controller('public')
export class PublicOnlineOrdersController {
  constructor(private readonly service: PublicOnlineOrdersService) {}

  // Read-only and cacheable by the client; the generous limit is there to
  // absorb a customer tapping around the menu, not to stop them.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('online-menu/:branchId')
  getMenu(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.service.getMenu(branchId);
  }

  // The expensive one: it writes. A human places one order every few minutes
  // at most, so 5/min per IP is already far above real use while capping what
  // a script can insert. Shared public wifi is the reason it isn't lower.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('online-orders')
  create(@Body() dto: CreatePublicOrderDto) {
    return this.service.createOrder(dto);
  }

  // Polled every few seconds by the customer's waiting screen, which is why
  // this limit is the loosest of the three.
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get('online-orders/:token')
  getStatus(@Param('token') token: string) {
    return this.service.getStatus(token);
  }
}
