"use client";

import {
  LandingDocPage,
  LandingDocHeader,
  LandingDocBody,
} from '@/components/landing/LandingDocPage';

export default function RefundPolicyPage() {
  return (
    <LandingDocPage>
      <LandingDocHeader
        title="Refund Policy"
        updated={new Date().toLocaleDateString()}
      />
      <LandingDocBody>
        <div className="landing-doc-sections">
          <section>
            <h2>Credits and digital purchases</h2>
            <p>
              All sales of credits and other digital purchases on Blabber are final. We do not
              offer refunds, chargebacks, or exchanges for credit purchases once the transaction
              has completed, except where required by applicable law.
            </p>
            <p>
              If you believe a charge was made in error, contact{' '}
              <a href="mailto:support@blabber.ai">support@blabber.ai</a> with your account
              details and transaction information so we can review your case.
            </p>
          </section>
        </div>
      </LandingDocBody>
    </LandingDocPage>
  );
}
