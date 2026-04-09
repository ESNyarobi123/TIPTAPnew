import { formatMinorUnits } from './format';
import type { PayrollSlipRecord } from './api/staff';
import { payrollLineIsDeduction, payrollLineLabel } from './payroll';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export function openPayrollSlipPrint(slip: PayrollSlipRecord) {
  if (typeof window === 'undefined') {
    return;
  }
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=980,height=1100');
  if (!popup) {
    return;
  }

  const lineItems = slip.compensationRows
    .map((line) => {
      const label = payrollLineLabel(line.lineKind ?? null, line.label ?? null);
      const amount = formatMinorUnits(line.amountCents, line.currency || slip.currency);
      const tone = payrollLineIsDeduction(line.lineKind ?? null) ? '#b45309' : '#0f766e';
      return `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td>${escapeHtml(line.periodLabel ?? slip.periodLabel)}</td>
          <td style="color:${tone}; text-align:right;">${escapeHtml(amount)}</td>
        </tr>
      `;
    })
    .join('');

  const recordedCents = slip.disbursements
    .filter((row) => row.status === 'RECORDED')
    .reduce((sum, row) => sum + row.amountCents, 0);
  const remainingCents = Math.max(0, slip.netCents - recordedCents);

  const disbursements = slip.disbursements.length
    ? slip.disbursements
        .map(
          (row) => `
        <div class="pill">
          <strong>${escapeHtml(row.method.replaceAll('_', ' '))}</strong>
          <span>${escapeHtml(formatMinorUnits(row.amountCents, slip.currency))}</span>
          <span>${escapeHtml(row.reference ?? row.accountMask ?? 'Recorded')}</span>
        </div>
      `,
        )
        .join('')
    : '<div class="pill">No disbursement recorded yet</div>';

  const summaryBlocks: Array<[string, number]> = [
    ['Basic salary', slip.baseSalaryCents],
    ['Allowances', slip.allowanceCents],
    ['Commissions', slip.commissionCents],
    ['Bonuses', slip.bonusCents],
    ['Tip share', slip.tipShareCents],
    ['Overtime', slip.overtimeCents],
    ['Service charge', slip.serviceChargeCents],
    ['Adjustments', slip.adjustmentCents],
    ['Advance recovery', slip.advanceRecoveryCents],
    ['Other deductions', slip.otherDeductionCents],
  ];
  const summaryBlockMarkup = summaryBlocks
    .filter(([, amount]) => amount > 0)
    .map(
      ([label, amount]) => `
        <div class="mini-block">
          <div class="label">${escapeHtml(label)}</div>
          <div class="value">${escapeHtml(formatMinorUnits(amount, slip.currency))}</div>
        </div>
      `,
    )
    .join('');

  popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>TIPTAP Payslip ${escapeHtml(slip.slipNumber)}</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f4efe5; color: #111827; }
      .page { padding: 30px; }
      .card { background: #fffdf8; border: 1px solid rgba(17,24,39,0.08); border-radius: 28px; padding: 28px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); }
      .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase; color: #6b7280; }
      h1 { margin: 10px 0 0; font-size: 34px; line-height: 1.1; }
      .muted { color: #6b7280; }
      .grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; margin-top: 18px; }
      .block { border: 1px solid rgba(17,24,39,0.08); border-radius: 18px; background: #f8f5ed; padding: 14px; }
      .mini-grid { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin-top: 18px; }
      .mini-block { border: 1px solid rgba(17,24,39,0.08); border-radius: 18px; background: #fff; padding: 12px; }
      .label { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7280; }
      .value { margin-top: 8px; font-size: 15px; font-weight: 600; color: #111827; }
      .mono { font-family: "SFMono-Regular", Menlo, Consolas, monospace; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; }
      th, td { padding: 12px 10px; border-bottom: 1px solid rgba(17,24,39,0.08); text-align: left; font-size: 14px; }
      th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #6b7280; }
      .totals { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; margin-top: 18px; }
      .pill-wrap { display:flex; flex-wrap:wrap; gap: 10px; margin-top: 16px; }
      .pill { border-radius: 999px; background: #f8f5ed; padding: 10px 14px; border: 1px solid rgba(17,24,39,0.08); display:inline-flex; gap: 10px; align-items:center; font-size: 13px; }
      .footer { margin-top: 18px; font-size: 12px; color: #6b7280; }
      @media print { body { background: white; } .page { padding: 0; } .card { border: 0; box-shadow: none; border-radius: 0; } }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="card">
        <div class="eyebrow">TIPTAP payroll</div>
        <h1>Payslip</h1>
        <p class="muted">${escapeHtml(slip.tenant?.name ?? 'Business')} · ${escapeHtml(slip.branch?.name ?? 'Tenant-wide')}</p>
        <div class="grid">
          <div class="block"><div class="label">Slip number</div><div class="value mono">${escapeHtml(slip.slipNumber)}</div></div>
          <div class="block"><div class="label">Staff</div><div class="value">${escapeHtml(slip.staff?.displayName ?? 'Staff')}</div></div>
          <div class="block"><div class="label">Period</div><div class="value">${escapeHtml(slip.periodLabel)}</div></div>
          <div class="block"><div class="label">Period start</div><div class="value">${escapeHtml(formatDate(slip.periodStart))}</div></div>
          <div class="block"><div class="label">Period end</div><div class="value">${escapeHtml(formatDate(slip.periodEnd))}</div></div>
          <div class="block"><div class="label">Effective</div><div class="value">${escapeHtml(formatDate(slip.effectiveDate))}</div></div>
          <div class="block"><div class="label">Status</div><div class="value">${escapeHtml(slip.status)}</div></div>
          <div class="block"><div class="label">Paid at</div><div class="value">${escapeHtml(formatDate(slip.paidAt))}</div></div>
          <div class="block"><div class="label">Verification</div><div class="value mono">${escapeHtml(`${slip.slipNumber}-${slip.id.slice(-6).toUpperCase()}`)}</div></div>
        </div>
        ${summaryBlockMarkup ? `<div class="mini-grid">${summaryBlockMarkup}</div>` : ''}
        <table>
          <thead>
            <tr>
              <th>Line</th>
              <th>Period</th>
              <th style="text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>${lineItems || '<tr><td colspan="3">No line items</td></tr>'}</tbody>
        </table>
        <div class="totals">
          <div class="block"><div class="label">Gross</div><div class="value">${escapeHtml(formatMinorUnits(slip.grossCents, slip.currency))}</div></div>
          <div class="block"><div class="label">Deductions</div><div class="value">${escapeHtml(formatMinorUnits(slip.deductionCents, slip.currency))}</div></div>
          <div class="block"><div class="label">Net pay</div><div class="value">${escapeHtml(formatMinorUnits(slip.netCents, slip.currency))}</div></div>
          <div class="block"><div class="label">Recorded</div><div class="value">${escapeHtml(formatMinorUnits(recordedCents, slip.currency))}</div></div>
          <div class="block"><div class="label">Remaining</div><div class="value">${escapeHtml(formatMinorUnits(remainingCents, slip.currency))}</div></div>
          <div class="block"><div class="label">Disbursements</div><div class="value">${escapeHtml(String(slip.disbursements.length))}</div></div>
        </div>
        <div class="pill-wrap">${disbursements}</div>
        <p class="footer">Generated from TIPTAP payroll desk. Keep this slip number for payroll support and verification.</p>
      </section>
    </div>
    <script>window.onload = () => window.print();</script>
  </body>
</html>`);
  popup.document.close();
}
