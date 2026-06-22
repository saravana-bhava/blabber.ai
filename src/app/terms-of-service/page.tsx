'use client';

import {
  LandingDocPage,
  LandingDocHeader,
  LandingDocBody,
} from '@/components/landing/LandingDocPage';

export default function TermsOfServicePage() {
  return (
    <LandingDocPage>
      <LandingDocHeader
        title="Terms of Service"
        updated={new Date().toLocaleDateString()}
      />
      <LandingDocBody>
        <div className="landing-doc-sections">
            <section>
              <h2>1. Agreement to Terms</h2>
              <p>
                By accessing or using Blabber AI (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you disagree with any part of these terms, then you may not access the Service.
              </p>
              <p>
                These Terms apply to all visitors, users, and others who access or use the Service. Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms.
              </p>
            </section>

            <section>
              <h2>2. Description of Service</h2>
              <p>
                Blabber AI is a platform that connects creators with fans through AI-powered interactions, content creation, subscriptions, and various monetization features. The Service includes but is not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>AI-powered voice and chat interactions</li>
                <li>Content creation and sharing tools</li>
                <li>Subscription services</li>
                <li>Pay-per-view content</li>
                <li>Digital product sales</li>
                <li>Messaging and communication features</li>
              </ul>
            </section>

            <section>
              <h2>3. User Accounts</h2>
              <p>
                <strong>3.1 Account Creation.</strong> To access certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
              </p>
              <p>
                <strong>3.2 Account Security.</strong> You are responsible for safeguarding your password and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
              <p>
                <strong>3.3 Age Requirement.</strong> You must be at least 18 years old to use the Service. By using the Service, you represent and warrant that you are at least 18 years of age.
              </p>
              <p>
                <strong>3.4 Account Termination.</strong> We reserve the right to suspend or terminate your account at any time, with or without notice, for any reason, including but not limited to violation of these Terms.
              </p>
            </section>

            <section>
              <h2>4. User Content</h2>
              <p>
                <strong>4.1 Content Ownership.</strong> You retain ownership of any content you create, upload, or post on the Service (&quot;User Content&quot;). By posting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, distribute, and display your User Content in connection with the Service.
              </p>
              <p>
                <strong>4.2 Content Responsibility.</strong> You are solely responsible for your User Content and the consequences of posting it. You represent and warrant that you have the right to post all User Content and that it does not violate any third-party rights.
              </p>
              <p>
                <strong>4.3 Prohibited Content.</strong> You agree not to post content that:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Is illegal, harmful, or violates any applicable laws</li>
                <li>Infringes on intellectual property rights</li>
                <li>Contains hate speech, harassment, or discrimination</li>
                <li>Involves unauthorized collection of user data</li>
                <li>Violates our Community Guidelines</li>
              </ul>
              <p>
                <strong>4.4 Content Removal.</strong> We reserve the right to remove any User Content that violates these Terms or that we determine, in our sole discretion, is harmful, objectionable, or inappropriate.
              </p>
            </section>

            <section>
              <h2>5. Creator Services and Payments</h2>
              <p>
                <strong>5.1 Creator Accounts.</strong> Creators may offer subscription services, pay-per-view content, digital products, and other monetization features through the Service.
              </p>
              <p>
                <strong>5.2 Payment Processing.</strong> All payments are processed through third-party payment processors. We are not responsible for any payment processing errors or issues.
              </p>
              <p>
                <strong>5.3 Subscriptions.</strong> Subscription fees are billed in advance on a recurring basis. You may cancel your subscription at any time, but cancellation will take effect at the end of your current billing period.
              </p>
              <p>
                <strong>5.4 Refunds.</strong> All sales are final unless otherwise required by law. Refunds may be issued at our sole discretion on a case-by-case basis.
              </p>
              <p>
                <strong>5.5 Creator Earnings.</strong> Creators are responsible for their own tax obligations related to earnings from the Service. We do not guarantee any level of earnings.
              </p>
            </section>

            <section>
              <h2>6. Intellectual Property</h2>
              <p>
                The Service and its original content, features, and functionality are owned by Blabber AI and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
              <p>
                Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
              </p>
            </section>

            <section>
              <h2>7. Prohibited Uses</h2>
              <p>You agree not to use the Service:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>In any way that violates any applicable law or regulation</li>
                <li>To transmit any malicious code or harmful software</li>
                <li>To impersonate or attempt to impersonate any person or entity</li>
                <li>To engage in any form of automated data collection or scraping</li>
                <li>To interfere with or disrupt the Service or servers connected to the Service</li>
                <li>To attempt to gain unauthorized access to any portion of the Service</li>
              </ul>
            </section>

            <section>
              <h2>8. Termination</h2>
              <p>
                We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms.
              </p>
              <p>
                Upon termination, your right to use the Service will cease immediately. All provisions of these Terms that by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, and limitations of liability.
              </p>
            </section>

            <section>
              <h2>9. Disclaimers</h2>
              <p>
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
              <p>
                We do not warrant that the Service will be uninterrupted, secure, or error-free, or that defects will be corrected. We do not warrant or make any representations regarding the use or results of the Service in terms of accuracy, reliability, or otherwise.
              </p>
            </section>

            <section>
              <h2>10. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL BLABBER AI, ITS DIRECTORS, OFFICERS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE.
              </p>
              <p>
                Our total liability to you for all claims arising from or related to the Service shall not exceed the amount you paid to us in the twelve (12) months preceding the claim, or $100, whichever is greater.
              </p>
            </section>

            <section>
              <h2>11. Indemnification</h2>
              <p>
                You agree to defend, indemnify, and hold harmless Blabber AI and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including without limitation reasonable legal and accounting fees, arising out of or in any way connected with your access to or use of the Service or your violation of these Terms.
              </p>
            </section>

            <section>
              <h2>12. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the State of Ohio, United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be subject to the exclusive jurisdiction of the courts located in Hamilton County, Ohio.
              </p>
            </section>

            <section>
              <h2>13. Dispute Resolution</h2>
              <p>
                <strong>13.1 Arbitration.</strong> Any dispute, controversy, or claim arising out of or relating to these Terms or the Service shall be settled by binding arbitration in accordance with the rules of the American Arbitration Association, except where prohibited by law.
              </p>
              <p>
                <strong>13.2 Class Action Waiver.</strong> You agree that any disputes will be resolved individually and not as part of a class action.
              </p>
            </section>

            <section>
              <h2>14. Changes to Terms</h2>
              <p>
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
              </p>
              <p>
                By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, you must stop using the Service.
              </p>
            </section>

            <section>
              <h2>15. No Employment Relationship</h2>
              <p>
                Creators using the Service are independent contractors and not employees, agents, or partners of Blabber AI. Creators are solely responsible for their own content, earnings, and tax obligations.
              </p>
            </section>

            <section>
              <h2>16. Contact Information</h2>
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <p>
                Email: <a href="mailto:support@blabber.ai">support@blabber.ai</a>
              </p>
              <p>
                Blabber Labs Inc.<br />
                1007 N ORANGE ST, 4TH FLOOR STE 5660<br />
                WILMINGTON, DE 19801<br />
                United States
              </p>
            </section>
        </div>
      </LandingDocBody>
    </LandingDocPage>
  );
}
