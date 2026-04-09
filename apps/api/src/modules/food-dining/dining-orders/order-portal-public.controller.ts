import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicAbuseThrottle } from '../../../common/decorators/public-abuse-throttle.decorator';
import { DiningOrdersService } from './dining-orders.service';

@ApiTags('food-dining')
@Controller('food-dining/order-portal')
export class OrderPortalPublicController {
  constructor(private readonly orders: DiningOrdersService) {}

  @Public()
  @PublicAbuseThrottle(120, 60_000)
  @Get(':token')
  @ApiOperation({ summary: 'Customer: read-only dining order snapshot (opaque portal token)' })
  getByToken(@Param('token') token: string) {
    return this.orders.getPublicOrderByPortalToken(token);
  }
}
