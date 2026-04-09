import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicAbuseThrottle } from '../../../common/decorators/public-abuse-throttle.decorator';
import { BeautyBookingsService } from './beauty-bookings.service';

@ApiTags('beauty-grooming')
@Controller('beauty-grooming/booking-portal')
export class BookingPortalPublicController {
  constructor(private readonly bookings: BeautyBookingsService) {}

  @Public()
  @PublicAbuseThrottle(120, 60_000)
  @Get(':token')
  @ApiOperation({ summary: 'Customer: read-only booking snapshot (opaque portal token)' })
  getByToken(@Param('token') token: string) {
    return this.bookings.getPublicBookingByPortalToken(token);
  }
}
