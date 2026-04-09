/** Recharts / chart styling anchored to TIPTAP brand (smoke + ivory). */
export const CHART = {
  primary: '#282427',
  primaryMuted: 'rgba(40, 36, 39, 0.45)',
  grid: 'rgba(40, 36, 39, 0.08)',
  axis: '#5C5660',
  tooltipBg: '#FAF9F2',
  tooltipBorder: 'rgba(40, 36, 39, 0.12)',
  subtleFill: 'rgba(40, 36, 39, 0.06)',
  accentLine: '#3D3841',
} as const;

export const chartTooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${CHART.tooltipBorder}`,
  background: CHART.tooltipBg,
  boxShadow: '0 8px 24px -8px rgba(40, 36, 39, 0.12)',
};
