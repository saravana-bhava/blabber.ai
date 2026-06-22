import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { BlabberShell } from './blabber-shell';
import { absoluteLogoUrl } from './logo-url';

type ContentRemovalRequestEmailProps = {
  name: string;
  email: string;
  contentUrls: string;
  agreedToDistribution: boolean;
  additionalInfo: string;
  /** Defaults handled in absoluteLogoUrl if omitted (e.g. React Email preview). */
  siteUrl?: string;
};

/** Internal notification — sent via Resend from the API route */
export default function ContentRemovalRequestEmail({
  name,
  email,
  contentUrls,
  agreedToDistribution,
  additionalInfo,
  siteUrl,
}: ContentRemovalRequestEmailProps) {
  return (
    <BlabberShell
      heading="Content removal request"
      logoSrc={absoluteLogoUrl(siteUrl)}
      footerSiteUrlTemplate={siteUrl}
    >
      <Section
        style={{
          backgroundColor: '#18181b',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
        }}
      >
        <Text style={{ color: '#e4e4e7', fontSize: '14px', margin: '0 0 8px' }}>
          <strong>Name:</strong> {name}
        </Text>
        <Text style={{ color: '#e4e4e7', fontSize: '14px', margin: '0 0 8px' }}>
          <strong>Email:</strong> {email}
        </Text>
        <Text style={{ color: '#e4e4e7', fontSize: '14px', margin: '0 0 8px' }}>
          <strong>Agreed to prior distribution:</strong>{' '}
          {agreedToDistribution ? 'Yes' : 'No'}
        </Text>
      </Section>
      <Text style={{ color: '#a1a1aa', fontSize: '14px', margin: '0 0 8px', fontWeight: 600 }}>
        URLs / content
      </Text>
      <Text
        style={{
          color: '#d4d4d8',
          fontSize: '13px',
          lineHeight: '20px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: '0 0 20px',
        }}
      >
        {contentUrls}
      </Text>
      <Text style={{ color: '#a1a1aa', fontSize: '14px', margin: '0 0 8px', fontWeight: 600 }}>
        Additional information
      </Text>
      <Text
        style={{
          color: '#d4d4d8',
          fontSize: '13px',
          lineHeight: '20px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: 0,
        }}
      >
        {additionalInfo}
      </Text>
    </BlabberShell>
  );
}
