export type BusinessCategory = 'FOOD_DINING' | 'BEAUTY_GROOMING';

export type TenantCategoryRow = {
  category: BusinessCategory | string;
  enabled?: boolean;
  settings?: Record<string, unknown> | null;
};

export function enabledBusinessCategories(rows: TenantCategoryRow[] | null | undefined): BusinessCategory[] {
  return (rows ?? [])
    .filter((row): row is TenantCategoryRow & { category: BusinessCategory } =>
      row.enabled === true && (row.category === 'FOOD_DINING' || row.category === 'BEAUTY_GROOMING'),
    )
    .map((row) => row.category);
}

export function hasCategory(
  rows: TenantCategoryRow[] | null | undefined,
  category: BusinessCategory,
): boolean {
  return enabledBusinessCategories(rows).includes(category);
}

export function primaryBusinessCategory(
  rows: TenantCategoryRow[] | null | undefined,
): BusinessCategory | null {
  const enabled = enabledBusinessCategories(rows);
  if (enabled.includes('FOOD_DINING')) {
    return 'FOOD_DINING';
  }
  if (enabled.includes('BEAUTY_GROOMING')) {
    return 'BEAUTY_GROOMING';
  }
  return null;
}
