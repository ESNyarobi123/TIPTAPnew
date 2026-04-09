export type NavItem = {
  href: string;
  label: string;
  icon: string;
  section: string;
  children?: { href: string; label: string }[];
};

export const providerNav: NavItem[] = [
  { section: 'Today', href: '/provider', label: 'My day', icon: 'fluent-color:person-starburst-48' },
  {
    section: 'My work',
    href: '/provider/history',
    label: 'History',
    icon: 'fluent-color:history-24',
  },
  { section: 'My work', href: '/provider/requests', label: 'Requests', icon: 'fluent-color:chat-48' },
  { section: 'My work', href: '/provider/earnings', label: 'Earnings', icon: 'fluent-color:wallet-credit-card-16' },
  { section: 'My work', href: '/provider/tips', label: 'Tips', icon: 'fluent-color:coin-multiple-48' },
  { section: 'My work', href: '/provider/ratings', label: 'Ratings', icon: 'fluent-color:person-feedback-48' },
  { section: 'You', href: '/provider/profile', label: 'Profile', icon: 'fluent-color:contact-card-48' },
  { section: 'You', href: '/provider/assignments', label: 'Assignments', icon: 'fluent-color:building-people-24' },
  { section: 'You', href: '/provider/settings', label: 'Settings', icon: 'fluent-color:apps-48' },
];
