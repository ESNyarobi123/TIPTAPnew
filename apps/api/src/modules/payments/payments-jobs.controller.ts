import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentsJobsService } from './payments-jobs.service';
import type { PaymentRefreshStatusJob, PaymentWebhookUpdateJob } from './payments-queue.constants';

@ApiExcludeController()
@Controller('payments/internal/jobs')
export class PaymentsJobsController {
  constructor(
    private readonly config: ConfigService,
    private readonly jobs: PaymentsJobsService,
  ) {}

  private assertInternalKey(header?: string) {
    const expected = this.config.get<string>('INTERNAL_SERVICES_KEY') ?? '';
    if (!expected || header !== expected) {
      throw new ForbiddenException('Invalid internal services key');
    }
  }

  @Public()
  @Post('webhook-update')
  @HttpCode(HttpStatus.OK)
  processWebhook(
    @Body() body: PaymentWebhookUpdateJob,
    @Headers('x-internal-services-key') key?: string,
  ) {
    this.assertInternalKey(key);
    return this.jobs.processWebhookUpdateJob(body);
  }

  @Public()
  @Post('refresh-status')
  @HttpCode(HttpStatus.OK)
  processRefresh(
    @Body() body: PaymentRefreshStatusJob,
    @Headers('x-internal-services-key') key?: string,
  ) {
    this.assertInternalKey(key);
    return this.jobs.processRefreshStatusJob(body);
  }
}
