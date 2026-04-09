import type { PayrollLineKind } from './api/staff';

export const payrollLineKindLabels: Record<PayrollLineKind, string> = {
  BASIC_SALARY: 'Basic salary',
  ALLOWANCE: 'Allowance',
  COMMISSION: 'Commission',
  BONUS: 'Bonus',
  TIP_SHARE: 'Tip share',
  OVERTIME: 'Overtime',
  SERVICE_CHARGE_SHARE: 'Service charge share',
  ADJUSTMENT: 'Adjustment',
  ADVANCE_RECOVERY: 'Advance recovery',
  DEDUCTION: 'Deduction',
};

export function payrollLineLabel(kind?: PayrollLineKind | null, fallback?: string | null) {
  if (fallback?.trim()) {
    return fallback.trim();
  }
  if (!kind) {
    return 'Payroll line';
  }
  return payrollLineKindLabels[kind] ?? kind.replaceAll('_', ' ');
}

export function payrollLineIsDeduction(kind?: PayrollLineKind | null) {
  return kind === 'DEDUCTION' || kind === 'ADVANCE_RECOVERY';
}

export function payrollStatusTone(status?: string | null) {
  switch (status) {
    case 'PAID':
    case 'RECONCILED':
      return 'text-teal-800';
    case 'APPROVED':
      return 'text-sky-800';
    case 'VOID':
      return 'text-rose-700';
    default:
      return 'text-amber-800';
  }
}
