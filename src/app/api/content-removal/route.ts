import { NextRequest, NextResponse } from 'next/server';
import ContentRemovalRequestEmail from '@/emails/content-removal-request';
import { getResend, getResendFromAddress, sendResendReactEmail } from '@/lib/email/resend';

function buildPlaintextSummary(payload: {
  name: string;
  email: string;
  contentUrls: string;
  agreedToDistribution: boolean;
  additionalInfo: string;
}) {
  return `
Content Removal Request

Name: ${payload.name}
Email: ${payload.email}

URLs/Links of content being reported:
${payload.contentUrls}

Have you ever agreed to the distribution of this content? ${payload.agreedToDistribution ? 'Yes' : 'No'}

Additional Information:
${payload.additionalInfo}

---
This request was submitted through the Content Removal form on Blabber AI.
  `.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, contentUrls, agreedToDistribution, additionalInfo } = body;

    if (!name || !email || !contentUrls || !additionalInfo) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const agreed = Boolean(agreedToDistribution);
    const plaintext = buildPlaintextSummary({
      name,
      email,
      contentUrls,
      additionalInfo,
      agreedToDistribution: agreed,
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://blabber.ai';
    const toAddress =
      process.env.RESEND_CONTENT_REMOVAL_TO ?? 'support@blabber.ai';

    if (!getResend()) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json({ success: true });
    }

    try {
      const result = await sendResendReactEmail({
        to: toAddress,
        subject: `Content removal request from ${name}`,
        react: ContentRemovalRequestEmail({
          name,
          email,
          contentUrls,
          agreedToDistribution: agreed,
          additionalInfo,
          siteUrl,
        }),
      });

      if (!result.ok) {
        console.error('Failed to send email via Resend:', result.error, {
          from: getResendFromAddress(),
          to: toAddress,
        });
      } else {
      }
    } catch (error) {
      console.error('Error sending via Resend:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending content removal request:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}
