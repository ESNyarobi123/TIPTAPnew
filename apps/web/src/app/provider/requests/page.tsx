'use client';

import { ProviderGuidedSurface } from '@/components/provider/provider-guided-surface';

export default function ProviderRequestsPage() {
  return (
    <ProviderGuidedSurface
      eyebrow="My work"
      title="Requests"
      description="Tasks routed to you."
      icon="fluent-color:chat-48"
      headline="Request queue"
      body="New requests will show here once your branch link is active."
      steps={[
        {
          icon: 'fluent-color:contact-card-48',
          text: 'Keep your profile complete.',
          href: '/provider/profile',
          cta: 'Open profile',
        },
        {
          icon: 'fluent-color:building-people-24',
          text: 'Confirm your branch assignment.',
          href: '/provider/assignments',
          cta: 'Assignments',
        },
        {
          icon: 'fluent-color:alert-24',
          text: 'No rows yet means nothing is assigned.',
        },
      ]}
    />
  );
}
