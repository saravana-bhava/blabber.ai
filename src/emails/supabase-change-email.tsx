import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { BlabberShell } from './blabber-shell';
import { SUPABASE_LOGO_IMG_SRC } from './logo-url';

/** Supabase → Change email address */
export default function SupabaseChangeEmailEmail() {
  return (
    <BlabberShell
      heading="Confirm email change"
      logoSrc={SUPABASE_LOGO_IMG_SRC}
    >
      <Text
        style={{
          color: '#a1a1aa',
          fontSize: '15px',
          lineHeight: '24px',
          margin: '0 0 20px',
        }}
      >
        Confirm that you want to use{' '}
        <span style={{ color: '#e4e4e7' }}>{'{{ .NewEmail }}'}</span> as the email for your
        account.
      </Text>
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button
          href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/home"
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
          Confirm new email
        </Button>
      </Section>
      <Text style={{ color: '#52525b', fontSize: '13px', lineHeight: '20px', margin: '0' }}>
        If you did not request this change, please secure your account.
      </Text>
    </BlabberShell>
  );
}
