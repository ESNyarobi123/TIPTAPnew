/** Paginate through admin list APIs until all rows are fetched (capped). */

export const MAX_ADMIN_CSV_ROWS = 5000;
export const ADMIN_EXPORT_PAGE_SIZE = 100;

export async function fetchAllAdminPages<T>(
  load: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const acc: T[] = [];
  let page = 1;
  while (acc.length < MAX_ADMIN_CSV_ROWS) {
    const { items, total } = await load(page, ADMIN_EXPORT_PAGE_SIZE);
    acc.push(...items);
    if (items.length === 0 || acc.length >= total || items.length < ADMIN_EXPORT_PAGE_SIZE) {
      break;
    }
    page += 1;
  }
  return acc.slice(0, MAX_ADMIN_CSV_ROWS);
}
