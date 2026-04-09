/** Uppercase alphanumeric prefix for ORD-XXX-0001 / BKG-XXX-0001 (min 3 chars). */
export function branchCodePrefix(branchCode: string): string {
  const alnum = branchCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (alnum.length >= 3) {
    return alnum.slice(0, 3);
  }
  return alnum.padEnd(3, 'X');
}
