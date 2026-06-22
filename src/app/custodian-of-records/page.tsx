'use client';

import {
  LandingDocPage,
  LandingDocHeader,
  LandingDocBody,
} from '@/components/landing/LandingDocPage';

export default function CustodianOfRecordsPage() {
  return (
    <LandingDocPage>
      <LandingDocHeader
        eyebrow="Compliance"
        title="18 U.S.C. 2257 Record-Keeping Requirements Compliance Statement"
        description="Disclosure required by 18 U.S.C. 2257 regarding record-keeping requirements."
        updated={new Date().toLocaleDateString()}
      />
      <LandingDocBody>
        <div className="landing-doc-sections">
          <section>
            <h2>1. Custodian of Records</h2>
            <p>The custodian of records for Blabber AI is located at:</p>
            <div className="landing-doc-quote">
              <p>
                Blabber Labs Inc.
                <br />
                1007 N ORANGE ST, 4TH FLOOR STE 5660
                <br />
                WILMINGTON, DE 19801
                <br />
                United States
              </p>
              <p>
                Email: <a href="mailto:support@blabber.ai">support@blabber.ai</a>
              </p>
            </div>
          </section>

          <section>
            <h2>2. Record-Keeping Requirements</h2>
            <p>
              All records required to be maintained pursuant to 18 U.S.C. 2257 are kept at the
              custodian of records address listed above. These records are available for inspection
              by authorized officials during normal business hours.
            </p>
          </section>

          <section>
            <h2>3. Age Verification Disclosure</h2>
            <p>
              All models, actors, actresses, and other persons who appear in any visual depiction
              of sexually explicit conduct appearing or otherwise contained in this website were over
              the age of eighteen (18) years at the time of the creation of such depictions.
            </p>
            <p>
              All other visual depictions displayed on this website are exempt from the provision
              of 18 U.S.C. 2257, 2257A and/or 28 C.F.R. 75, because 1) they do not consist of
              depictions of conduct as specifically defined in 18 U.S.C. 2256(2)(A) through (D), or
              2) they were created prior to July 3, 1995, or 3) they are exempt under other
              applicable laws.
            </p>
          </section>

          <section>
            <h2>4. Record Requests</h2>
            <p>
              To request records or file a complaint, please contact our custodian of records at
              the address or email provided above.
            </p>
          </section>

          <section>
            <h2>5. Contact Information</h2>
            <p>For all inquiries regarding records or compliance with 18 U.S.C. 2257, please contact:</p>
            <p>
              Email: <a href="mailto:support@blabber.ai">support@blabber.ai</a>
            </p>
          </section>
        </div>
      </LandingDocBody>
    </LandingDocPage>
  );
}
