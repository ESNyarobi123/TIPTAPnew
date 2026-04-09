'use client';

import { ProviderGuidedSurface } from '@/components/provider/provider-guided-surface';

export default function ProviderSettingsPage() {
  return (
    <ProviderGuidedSurface
      eyebrow="Preferences"
      title="Settings"
      description="Personal preferences."
      icon="fluent-color:apps-48"
      headline="Quiet settings"
      body="Alerts and defaults will live here."
      steps={[
        {
          icon: 'fluent-color:chat-48',
          text: 'Alerts will show here.',
        },
        {
          icon: 'fluent-color:contact-card-48',
          text: 'Account details stay in your profile.',
          href: '/provider/profile',
          cta: 'Open profile',
        },
        {
          icon: 'fluent-color:alert-24',
          text: 'Manager setup stays separate.',
        },
      ]}
    />
  );
}
