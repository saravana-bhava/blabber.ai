import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { resolveEmailLogoImgSrc } from './resolve-logo-src';

/**
 * Dark shell with Blabber logo. For Supabase templates use logoSrc={`{{ .SiteURL }}/logo.png`}.
 *
 * We intentionally do not use @react-email/preview: it pads the hidden preheader with long runs of
 * zero-width unicode, which spam filters often score as obfuscation. Inbox snippets use visible copy.
 */
export function BlabberShell({
  children,
  heading,
  logoSrc,
  footerSiteUrlTemplate = '{{ .SiteURL }}',
  footerTagline = 'Creator Economy 2.0 — The all-in-one monetization platform for modern creators.',
}: {
  children: ReactNode;
  /** Absolute URL or Supabase `{{ .SiteURL }}/logo.png` */
  logoSrc: string;
  heading?: string;
  footerSiteUrlTemplate?: string;
  /** Short line echoing the marketing site (Hero + Product sections) */
  footerTagline?: string;
}) {
  return (
    <Html>
      <Head />
      <Body
        style={{
          backgroundColor: '#09090b',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: '520px',
            margin: '0 auto',
            padding: '40px 20px 56px',
          }}
        >
          <Section style={{ textAlign: 'left', marginBottom: '40px' }}>
            <Img
              src={resolveEmailLogoImgSrc(logoSrc)}
              alt="Blabber"
              width={140}
              height={32}
              style={{
                margin: 0,
                maxWidth: '140px',
                height: 'auto',
                display: 'block',
              }}
            />
          </Section>
          {heading ? (
            <Heading
              as="h1"
              style={{
                color: '#fafafa',
                fontSize: '22px',
                fontWeight: 600,
                lineHeight: '28px',
                margin: '0 0 20px',
                textAlign: 'left',
              }}
            >
              {heading}
            </Heading>
          ) : null}
          {children}
          <Hr
            style={{
              border: 'none',
              borderTop: '1px solid #27272a',
              margin: '32px 0 24px',
            }}
          />
          <Text
            style={{
              color: '#71717a',
              fontSize: '12px',
              lineHeight: '18px',
              textAlign: 'center',
              margin: '0 0 8px',
            }}
          >
            {footerTagline}
          </Text>
          <Text
            style={{
              color: '#71717a',
              fontSize: '12px',
              lineHeight: '18px',
              textAlign: 'center',
              margin: 0,
            }}
          >
            <Link
              href={footerSiteUrlTemplate}
              style={{ color: '#a1a1aa', textDecoration: 'underline' }}
            >
              Open Blabber
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
