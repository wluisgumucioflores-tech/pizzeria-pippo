import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentDevice } from '../common/decorators/current-device.decorator';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { AuthenticatedDevice } from '../devices/devices.service';
import { PaymentValidationService } from './payment-validation.service';
import { StartPaymentValidationDto } from './dto/start-payment-validation.dto';
import { RejectPaymentValidationDto } from './dto/reject-payment-validation.dto';
import { CancelPaymentValidationDto } from './dto/cancel-payment-validation.dto';
import { ReportPaymentNotificationDto } from './dto/report-payment-notification.dto';

@Controller('payment-validation')
export class PaymentValidationController {
  constructor(private readonly paymentValidationService: PaymentValidationService) {}

  @UseGuards(JwtAuthGuard)
  @Post('start')
  start(@Body() dto: StartPaymentValidationDto, @CurrentUser() user: CurrentUserPayload) {
    return this.paymentValidationService.start(dto.branch_id, user, dto.amount);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reject')
  reject(@Body() dto: RejectPaymentValidationDto) {
    this.paymentValidationService.reject(dto.request_id, dto.notification_id);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  cancel(@Body() dto: CancelPaymentValidationDto) {
    this.paymentValidationService.cancel(dto.request_id);
    return { ok: true };
  }

  // Called by the Android device, not by the browser — authenticated with its
  // own API key instead of a user JWT.
  @UseGuards(ApiKeyGuard)
  @Post('notifications')
  reportNotification(@Body() dto: ReportPaymentNotificationDto, @CurrentDevice() device: AuthenticatedDevice) {
    this.paymentValidationService.reportNotification(device.branchId, dto.amount, dto.payer_name, dto.raw_text);
    return { ok: true };
  }
}
