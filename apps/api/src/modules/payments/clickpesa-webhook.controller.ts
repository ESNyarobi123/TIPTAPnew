import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentsJobsService } from './payments-jobs.service';

@ApiTags('payments-webhooks')
@Controller('payments/webhooks')
export class ClickPesaWebhookController {
  constructor(private readonly jobs: PaymentsJobsService) {}

  @Public()
  @Post('clickpesa/:tenantId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'ClickPesa webhook (verify x-tiptap-webhook-secret when configured)',
  })
  async handle(
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-tiptap-webhook-secret') secret?: string,
  ) {
    const orderReference =
      typeof body.orderReference === 'string'
        ? body.orderReference
        : typeof body.order_reference === 'string'
          ? body.order_reference
          : '';
    const status =
      typeof body.status === 'string'
        ? body.status
        : typeof body.paymentStatus === 'string'
          ? body.paymentStatus
          : null;
    const externalRef =
      typeof body.transactionId === 'string'
        ? body.transactionId
        : typeof body.externalTransactionId === 'string'
          ? body.externalTransactionId
          : null;
    return this.jobs.enqueueWebhookUpdateValidated({
      tenantId,
      orderReference,
      providerStatus: status,
      externalRef,
      rawPayload: body,
      headerSecret: secret ?? null,
    });
  }
}
