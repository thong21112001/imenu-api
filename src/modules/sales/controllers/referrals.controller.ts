import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SalesService } from '../services/sales.service';
import { ApplyReferralDto } from '../dto/apply-referral.dto';
import { Public } from '../../../shared/common/decorators/public.decorator';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly salesService: SalesService) {}

  @Public()
  @Get('validate/:code')
  async validateReferralCode(@Param('code') code: string) {
    const result = await this.salesService.validateReferralCode(code);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Post('apply')
  async submitApplication(@Body() dto: ApplyReferralDto) {
    const result = await this.salesService.submitApplication(dto);
    return {
      success: true,
      ...result,
    };
  }
}
