import { describe, expect, it } from 'vitest';
import { defaultDateRange, formatMinorUnits } from './format';

describe('formatMinorUnits', () => {
  it('renders em dash for nullish amounts', () => {
    expect(formatMinorUnits(null)).toBe('—');
    expect(formatMinorUnits(undefined)).toBe('—');
  });

  it('formats cents as currency when Intl accepts the code', () => {
    const s = formatMinorUnits(12_345, 'TZS');
    expect(s).toMatch(/123/);
    expect(s).toMatch(/45/);
  });
});

describe('defaultDateRange', () => {
  it('returns ISO date strings spanning ~30 days', () => {
    const { startDate, endDate } = defaultDateRange();
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(startDate < endDate).toBe(true);
  });
});
