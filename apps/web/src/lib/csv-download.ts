/** Client-side CSV download for admin tables (current result set). */

function escCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = [
    headers.map(escCell).join(','),
    ...rows.map((r) => r.map(escCell).join(',')),
  ];
  const body = lines.join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
