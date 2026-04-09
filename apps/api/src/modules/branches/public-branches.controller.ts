import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublicAbuseThrottle } from '../../common/decorators/public-abuse-throttle.decorator';
import { BranchesService } from './branches.service';

@ApiTags('public')
@Controller('public/branches')
export class PublicBranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Public()
  @PublicAbuseThrottle(90, 60_000)
  @Get(':id')
  @ApiOperation({ summary: 'Public branch card (hours, contact — no auth)' })
  findOnePublic(@Param('id') id: string) {
    return this.branches.findPublicSnapshot(id);
  }
}
