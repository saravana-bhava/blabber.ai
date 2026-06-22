import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { BlabberShell } from './blabber-shell';
import { SUPABASE_LOGO_IMG_SRC } from './logo-url';

/** Supabase → Reset password */
export default function SupabaseResetPasswordEmail() {
  return (
    <BlabberShell
      heading="Reset your password"
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
        We received a request to reset the password for{' '}
        <span style={{ color: '#e4e4e7' }}>{'{{ .Email }}'}</span>.
      </Text>
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button
          href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/home"
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
          Reset password
        </Button>
      </Section>
      <Text style={{ color: '#52525b', fontSize: '13px', lineHeight: '20px', margin: '0' }}>
        If you did not ask for a reset, you can ignore this email.
      </Text>
    </BlabberShell>
  );
}
