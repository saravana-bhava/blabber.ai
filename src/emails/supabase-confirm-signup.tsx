import * as React from 'react';
import { Button, Hr, Section, Text } from '@react-email/components';
import { BlabberShell } from './blabber-shell';
import { SUPABASE_LOGO_IMG_SRC } from './logo-url';

/**
 * Paste rendered HTML into Supabase → Authentication → Email templates → Confirm signup.
 * Copy aligns with the public home page (Hero + product tagline + feature themes).
 */
export default function SupabaseConfirmSignupEmail() {
  return (
    <BlabberShell
      logoSrc={SUPABASE_LOGO_IMG_SRC}
      heading="Welcome to Blabber"
    >
      <Text
        style={{
          color: '#f472b6',
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          margin: '0 0 8px',
          textAlign: 'left' as const,
        }}
      >
        Creator Economy 2.0
      </Text>
      <Text
        style={{
          color: '#d4d4d8',
          fontSize: '17px',
          fontWeight: 600,
          lineHeight: '24px',
          margin: '0 0 16px',
          textAlign: 'left' as const,
        }}
      >
        The Creator Platform, Reinvented
      </Text>
      <Text
        style={{
          color: '#a1a1aa',
          fontSize: '15px',
          lineHeight: '24px',
          margin: '0 0 20px',
          textAlign: 'left' as const,
        }}
      >
        The all-in-one monetization platform for modern creators — own your audience, host AI-powered
        calls and chats, sell subscriptions and products, and keep more of what you earn.
      </Text>
      <Hr
        style={{
          border: 'none',
          borderTop: '1px solid #27272a',
          margin: '24px 0',
        }}
      />
      <Text
        style={{
          color: '#a1a1aa',
          fontSize: '15px',
          lineHeight: '24px',
          margin: '0 0 8px',
        }}
      >
        You&apos;re one step away. Confirm{' '}
        <span style={{ color: '#e4e4e7' }}>{'{{ .Email }}'}</span> to activate your account. After
        you tap the button, you&apos;ll be signed in and taken to Blabber.
      </Text>
      <Section style={{ textAlign: 'left', margin: '28px 0' }}>
        <Button
          href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/home"
          style={{
            backgroundColor: '#db2777',
            color: '#ffffff',
            padding: '14px 32px',
            borderRadius: '9999px',
            fontWeight: 600,
            fontSize: '15px',
            textDecoration: 'none',
            display: 'inline-block',
            lineHeight: '1',
          }}
        >
          Confirm email &amp; sign in
        </Button>
      </Section>
      <Text
        style={{
          color: '#a1a1aa',
          fontSize: '15px',
          lineHeight: '24px',
          margin: '0 0 8px',
        }}
      >
        Or enter this 6-digit code on the sign-up page:
      </Text>
      <Text
        style={{
          color: '#fafafa',
          fontSize: '28px',
          fontWeight: 700,
          letterSpacing: '0.35em',
          margin: '0 0 20px',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {'{{ .Token }}'}
      </Text>
      <Text style={{ color: '#52525b', fontSize: '13px', lineHeight: '20px', margin: '0' }}>
        Or copy this link into your browser:
        <br />
        <span style={{ color: '#71717a', wordBreak: 'break-all' }}>
          {'{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/home'}
        </span>
      </Text>
      <Text style={{ color: '#52525b', fontSize: '13px', lineHeight: '20px', margin: '24px 0 0' }}>
        If you did not sign up for Blabber, you can ignore this message.
      </Text>
    </BlabberShell>
  );
}
