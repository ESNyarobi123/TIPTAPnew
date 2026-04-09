import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicAbuseThrottle } from '../../../common/decorators/public-abuse-throttle.decorator';
import { PatchKdsItemDto } from './dto/patch-kds-item.dto';
import { KdsService } from './kds.service';

@ApiTags('food-dining')
@Controller('food-dining/kds')
export class KdsPublicController {
  constructor(private readonly kds: KdsService) {}

  @Public()
  @PublicAbuseThrottle(120, 60_000)
  @Get(':token/orders')
  @ApiOperation({ summary: 'Kitchen: live orders (public token)' })
  liveOrders(@Param('token') token: string) {
    return this.kds.getLiveOrders(token);
  }

  @Public()
  @PublicAbuseThrottle(120, 60_000)
  @Get(':token/history')
  @ApiOperation({ summary: 'Kitchen: recent completed orders (public token)' })
  history(@Param('token') token: string) {
    return this.kds.getHistory(token);
  }

  @Public()
  @PublicAbuseThrottle(90, 60_000)
  @Patch(':token/items/:itemId')
  @ApiOperation({ summary: 'Kitchen: update line item status (public token)' })
  patchItem(
    @Param('token') token: string,
    @Param('itemId') itemId: string,
    @Body() body: PatchKdsItemDto,
  ) {
    return this.kds.patchItemStatus(token, itemId, body);
  }
}
