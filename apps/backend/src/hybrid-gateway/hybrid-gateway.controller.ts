import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { HybridSmsDto } from './dto/hybrid-sms.dto';
import { HybridUssdDto } from './dto/hybrid-ussd.dto';
import { HybridIvrDto } from './dto/hybrid-ivr.dto';
import { HybridGatewayService } from './hybrid-gateway.service';
import { GatewaySecretGuard } from './guards/gateway-secret.guard';

@Controller('hybrid')
@UseGuards(GatewaySecretGuard)
export class HybridGatewayController {
  constructor(private readonly hybridGatewayService: HybridGatewayService) {}

  @Post('sms')
  async receiveSms(@Body() dto: HybridSmsDto) {
    return this.hybridGatewayService.handleSms(dto.operator, dto.payload);
  }

  @Post('ussd')
  async receiveUssd(@Body() dto: HybridUssdDto) {
    return this.hybridGatewayService.handleUssd(dto.operator, dto.payload);
  }

  @Post('ivr/summary')
  async ivrSummary(
    @Body() payload: HybridIvrDto,
  ) {
    return this.hybridGatewayService.buildIvrSummary(payload);
  }

  @Post('ivr/lesson-summary')
  async ivrLessonSummary(
    @Body() payload: HybridIvrDto,
  ) {
    return this.hybridGatewayService.buildIvrLessonSummary(payload);
  }
}
