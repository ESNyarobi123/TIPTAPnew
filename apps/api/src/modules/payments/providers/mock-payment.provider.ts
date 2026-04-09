import { Injectable } from '@nestjs/common';
import type { PaymentProvider } from './payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  name = 'mock';
}
