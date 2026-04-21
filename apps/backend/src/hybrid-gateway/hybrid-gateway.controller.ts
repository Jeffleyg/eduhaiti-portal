import { Body, Controller, Post } from "@nestjs/common"
import { HybridSmsDto } from "./dto/hybrid-sms.dto"
import { HybridUssdDto } from "./dto/hybrid-ussd.dto"
import { HybridGatewayService } from "./hybrid-gateway.service"

@Controller("hybrid")
export class HybridGatewayController {
  constructor(private readonly hybridGatewayService: HybridGatewayService) {}

  @Post("sms")
  async receiveSms(@Body() dto: HybridSmsDto) {
    return this.hybridGatewayService.handleSms(dto.operator, dto.payload)
  }

  @Post("ussd")
  async receiveUssd(@Body() dto: HybridUssdDto) {
    return this.hybridGatewayService.handleUssd(dto.operator, dto.payload)
  }
}
