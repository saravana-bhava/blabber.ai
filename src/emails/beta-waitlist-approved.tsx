import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { BlabberShell } from './blabber-shell';
import { absoluteLogoUrl } from './logo-url';

type BetaWaitlistApprovedEmailProps = {
  /** Optional first name / handle to personalize the greeting. */
  recipientName?: string | null;
  /** Discord invite URL. Filled in via env at send time. */
  discordInviteUrl: string;
  /** Direct sign-in link, e.g. https://blabber.ai/sign-in */
  signInUrl: string;
  /** Site origin used by BlabberShell (logo + footer). Optional in preview. */
  siteUrl?: string;
};

const linkButtonStyle: React.CSSProperties = {
  backgroundColor: '#ec4899',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '10px',
  display: 'inline-block',
};

const secondaryLinkButtonStyle: React.CSSProperties = {
  ...linkButtonStyle,
  backgroundColor: '#27272a',
};

/** Sent from the admin waitlist review page when a signup is approved. */
export default function BetaWaitlistApprovedEmail({
  recipientName,
  discordInviteUrl,
  signInUrl,
  siteUrl,
}: BetaWaitlistApprovedEmailProps) {
  const greeting = recipientName?.trim()
    ? `Hey ${recipientName.trim()},`
    : 'Hey there,';

  return (
    <BlabberShell
      heading="You're in. Welcome to the Blabber beta."
      logoSrc={absoluteLogoUrl(siteUrl)}
      footerSiteUrlTemplate={siteUrl}
    >
      <Text
        style={{
          color: '#e4e4e7',
          fontSize: '15px',
          lineHeight: '24px',
          margin: '0 0 16px',
        }}
      >
        {greeting}
      </Text>
      <Text
        style={{
          color: '#e4e4e7',
          fontSize: '15px',
          lineHeight: '24px',
          margin: '0 0 16px',
        }}
      >
        Thanks for signing up for the Blabber AI beta — we just approved your
        spot. You can sign in any time and start setting up your creator
        profile, voice sample, and personality.
      </Text>

      <Section style={{ margin: '24px 0 8px' }}>
        <Button href={signInUrl} style={linkButtonStyle}>
          Sign in to Blabber
        </Button>
      </Section>
      <Text
        style={{
          color: '#a1a1aa',
          fontSize: '13px',
          lineHeight: '20px',
          margin: '0 0 24px',
          wordBreak: 'break-all',
        }}
      >
        Or paste this link into your browser: {signInUrl}
      </Text>

      <Section
        style={{
          backgroundColor: '#18181b',
          borderRadius: '12px',
          padding: '20px',
          margin: '0 0 20px',
        }}
      >
        <Text
          style={{
            color: '#fafafa',
            fontSize: '15px',
            fontWeight: 600,
            margin: '0 0 8px',
          }}
        >
          Join the creator Discord
        </Text>
        <Text
          style={{
            color: '#d4d4d8',
            fontSize: '14px',
            lineHeight: '21px',
            margin: '0 0 16px',
          }}
        >
          We hang out, share product updates, and answer onboarding questions
          in our Discord. Pop in and say hi.
        </Text>
        <Button href={discordInviteUrl} style={secondaryLinkButtonStyle}>
          Join the Discord
        </Button>
      </Section>

      <Text
        style={{
          color: '#fafafa',
          fontSize: '15px',
          fontWeight: 600,
          margin: '20px 0 8px',
        }}
      >
        Quick start
      </Text>
      <Text
        style={{
          color: '#d4d4d8',
          fontSize: '14px',
          lineHeight: '22px',
          margin: '0 0 8px',
        }}
      >
        1. Sign in with the same email you used on the waitlist.
      </Text>
      <Text
        style={{
          color: '#d4d4d8',
          fontSize: '14px',
          lineHeight: '22px',
          margin: '0 0 8px',
        }}
      >
        2. Open Creator Settings → AI and record a 30-second voice sample (we
        provide a script).
      </Text>
      <Text
        style={{
          color: '#d4d4d8',
          fontSize: '14px',
          lineHeight: '22px',
          margin: '0 0 8px',
        }}
      >
        3. Tune your AI personality, set your subscription price, and start
        posting.
      </Text>
      <Text
        style={{
          color: '#d4d4d8',
          fontSize: '14px',
          lineHeight: '22px',
          margin: '0 0 24px',
        }}
      >
        4. Reply to this email any time — we read every one.
      </Text>

      <Text
        style={{
          color: '#a1a1aa',
          fontSize: '13px',
          lineHeight: '20px',
          margin: 0,
        }}
      >
        Welcome aboard,
        <br />
        The Blabber team
      </Text>
    </BlabberShell>
  );
}
