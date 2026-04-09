import type { BusinessCategory } from '@/lib/business-categories';

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  section: string;
  children?: { href: string; label: string }[];
  categories?: BusinessCategory[];
};

const NAV_ITEMS: NavItem[] = [
  { section: 'Control room', href: '/dashboard', label: 'Overview', icon: 'fluent-color:apps-48' },
  { section: 'Control room', href: '/dashboard/operations', label: 'Manager hub', icon: 'fluent-color:apps-list-detail-32' },
  { section: 'Guest channels', href: '/dashboard/qr', label: 'QR launch', icon: 'fluent-color:apps-list-detail-32' },
  { section: 'Guest channels', href: '/dashboard/conversations', label: 'WhatsApp inbox', icon: 'fluent-color:chat-48' },
  {
    section: 'Guest channels',
    href: '/dashboard/feedback-ratings',
    label: 'Feedback & Ratings',
    icon: 'fluent-color:person-feedback-48',
  },
  { section: 'Team & service', href: '/dashboard/staff', label: 'Staff & providers', icon: 'fluent-color:people-team-48' },
  {
    section: 'Team & service',
    href: '/dashboard/food-dining',
    label: 'Food & Dining',
    icon: 'fluent-color:building-store-24',
    categories: ['FOOD_DINING'],
  },
  {
    section: 'Team & service',
    href: '/dashboard/beauty-grooming',
    label: 'Beauty & Grooming',
    icon: 'fluent-color:person-starburst-48',
    categories: ['BEAUTY_GROOMING'],
  },
  { section: 'Money & trust', href: '/dashboard/payments', label: 'Payments', icon: 'fluent-color:coin-multiple-48' },
  { section: 'Money & trust', href: '/dashboard/analytics', label: 'Analytics', icon: 'fluent-color:data-trending-48' },
  { section: 'Money & trust', href: '/dashboard/statements', label: 'Statements', icon: 'fluent-color:contact-card-48' },
  { section: 'Money & trust', href: '/dashboard/reconciliation', label: 'Reconciliation', icon: 'fluent-color:alert-24' },
  { section: 'Governance', href: '/dashboard/audit-logs', label: 'Audit logs', icon: 'fluent-color:book-database-32' },
  {
    section: 'Growth & setup',
    href: '/dashboard/settings',
    label: 'Setup',
    icon: 'fluent-color:globe-shield-48',
    children: [
      { href: '/dashboard/settings', label: 'Overview' },
      { href: '/dashboard/settings/profile', label: 'Profile' },
      { href: '/dashboard/settings/business', label: 'Business' },
      { href: '/dashboard/settings/branch', label: 'Branch' },
      { href: '/dashboard/settings/landing', label: 'Landing page' },
      { href: '/dashboard/settings/payments', label: 'Payment config' },
      { href: '/dashboard/settings/categories', label: 'Categories' },
    ],
  },
];

/**
 * Sidebar items: entries with `categories` only appear when at least one matching
 * vertical is enabled for the tenant. If nothing is enabled yet, hide vertical-specific
 * modules (Food / Beauty) until Setup → Categories turns them on.
 */
export function getDashboardNav(enabledCategories: BusinessCategory[] = []) {
  if (!enabledCategories.length) {
    return NAV_ITEMS.filter((item) => !item.categories?.length);
  }
  return NAV_ITEMS.filter((item) => {
    if (!item.categories?.length) {
      return true;
    }
    return item.categories.some((category) => enabledCategories.includes(category));
  });
}

export const mainNav = NAV_ITEMS;
