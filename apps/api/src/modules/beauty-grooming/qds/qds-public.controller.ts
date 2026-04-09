import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicAbuseThrottle } from '../../../common/decorators/public-abuse-throttle.decorator';
import { PatchQdsBookingDto } from './dto/patch-qds-booking.dto';
import { QdsService } from './qds.service';

@ApiTags('beauty-grooming')
@Controller('beauty-grooming/qds')
export class QdsPublicController {
  constructor(private readonly qds: QdsService) {}

  @Public()
  @PublicAbuseThrottle(120, 60_000)
  @Get(':token/queue')
  @ApiOperation({ summary: 'Queue display: waiting / in-service / upcoming (public token)' })
  queue(@Param('token') token: string) {
    return this.qds.getQueue(token);
  }

  @Public()
  @PublicAbuseThrottle(120, 60_000)
  @Get(':token/providers')
  @ApiOperation({ summary: 'Staff assigned to branch (public token)' })
  providers(@Param('token') token: string) {
    return this.qds.getProviders(token);
  }

  @Public()
  @PublicAbuseThrottle(60, 60_000)
  @Patch(':token/bookings/:id')
  @ApiOperation({ summary: 'Reception: update booking status (public token)' })
  patchBooking(
    @Param('token') token: string,
    @Param('id') id: string,
    @Body() body: PatchQdsBookingDto,
  ) {
    return this.qds.patchBooking(token, id, body);
  }
}
