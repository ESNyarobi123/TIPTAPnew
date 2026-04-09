export type NavItem = {
  href: string;
  label: string;
  icon: string;
  section: string;
  children?: { href: string; label: string }[];
};

export const adminNav: NavItem[] = [
  { section: 'Control tower', href: '/admin', label: 'Overview', icon: 'fluent-color:apps-48' },
  { section: 'Platform core', href: '/admin/tenants', label: 'Tenants', icon: 'fluent-color:building-store-24' },
  { section: 'Platform core', href: '/admin/service-staff', label: 'Service staff', icon: 'fluent-color:contact-card-48' },
  { section: 'Platform core', href: '/admin/dining-orders', label: 'Dining orders', icon: 'fluent-color:food-48' },
  { section: 'Platform core', href: '/admin/beauty-bookings', label: 'Beauty bookings', icon: 'fluent-color:calendar-people-20' },
  { section: 'Platform core', href: '/admin/orders', label: 'Payment ledger', icon: 'fluent-color:receipt-24' },
  { section: 'Platform core', href: '/admin/users', label: 'Users & roles', icon: 'fluent-color:people-team-48' },
  { section: 'Platform core', href: '/admin/approvals', label: 'Approvals', icon: 'fluent-color:approvals-app-24' },
  { section: 'Platform core', href: '/admin/impersonation', label: 'Impersonation', icon: 'fluent-color:scan-person-24' },
  { section: 'Platform core', href: '/admin/system', label: 'System settings', icon: 'fluent-color:settings-24' },
  {
    section: 'Money & trust',
    href: '/admin/payments-health',
    label: 'Payment health',
    icon: 'fluent-color:gauge-24',
  },
  {
    section: 'Money & trust',
    href: '/admin/reconciliation',
    label: 'Reconciliation',
    icon: 'fluent-color:chart-multiple-24',
  },
  {
    section: 'Money & trust',
    href: '/admin/compensations',
    label: 'Staff compensation',
    icon: 'fluent-color:coin-multiple-48',
  },
  { section: 'Intelligence', href: '/admin/audit-risk', label: 'Audit & risk', icon: 'fluent-color:lock-shield-48' },
  {
    section: 'Intelligence',
    href: '/admin/category-adoption',
    label: 'Category adoption',
    icon: 'fluent-color:options-24',
  },
];
