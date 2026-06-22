'use client';

import {
  LandingDocPage,
  LandingDocHeader,
  LandingDocBody,
} from '@/components/landing/LandingDocPage';

export default function PrivacyPolicyPage() {
  return (
    <LandingDocPage>
      <LandingDocHeader
        title="Privacy Policy"
        updated={new Date().toLocaleDateString()}
      />
      <LandingDocBody>
        <div className="landing-doc-sections">
            <section>
              <h2>1. Introduction</h2>
              <p>
                Blabber Labs Inc. (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform and services (the &quot;Service&quot;).
              </p>
              <p>
                By using the Service, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with our policies and practices, do not use the Service.
              </p>
            </section>

            <section>
              <h2>2. Information We Collect</h2>
              
              <h3>2.1 Information You Provide</h3>
              <p>We collect information that you voluntarily provide to us, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Information:</strong> Name, email address, username, password, profile information, and avatar</li>
                <li><strong>Billing Information:</strong> Billing address and transaction history. <strong>Note:</strong> We do not collect or store credit card information. All payment processing is handled by third-party payment processors who are PCI-DSS compliant.</li>
                <li><strong>Content:</strong> Posts, messages, images, videos, audio recordings, and other content you create or share</li>
                <li><strong>Communication Data:</strong> Messages sent through the platform, customer support inquiries, and feedback</li>
                <li><strong>Voice and Chat Logs:</strong> Recordings of AI interactions, voice calls, and chat conversations for service delivery and improvement</li>
              </ul>

              <h3>2.2 Information Automatically Collected</h3>
              <p>When you use the Service, we automatically collect certain information, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Device Information:</strong> IP address, device type, operating system, browser type, and device identifiers</li>
                <li><strong>Usage Data:</strong> Pages visited, time spent on pages, features used, clicks, and navigation patterns</li>
                <li><strong>Location Data:</strong> General geographic location based on IP address</li>
                <li><strong>Cookies and Tracking Technologies:</strong> See our Cookie Policy section below</li>
              </ul>

              <h3>2.3 Information from Third Parties</h3>
              <p>We may receive information from third-party services, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Payment processors (transaction confirmations and payment status)</li>
                <li>Social media platforms (if you connect your account)</li>
                <li>Analytics providers and advertising partners</li>
              </ul>
            </section>

            <section>
              <h2>3. How We Use Your Information</h2>
              <p>We use the information we collect for the following purposes:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Service Delivery:</strong> To provide, maintain, and improve our Service, process transactions, and fulfill your requests</li>
                <li><strong>Account Management:</strong> To create and manage your account, authenticate users, and provide customer support</li>
                <li><strong>Communication:</strong> To send you service-related notifications, respond to inquiries, and provide customer support</li>
                <li><strong>Content Processing:</strong> To store, process, and display your content, including AI-powered interactions and voice/chat logs</li>
                <li><strong>Personalization:</strong> To personalize your experience, recommend content, and customize the Service</li>
                <li><strong>Analytics:</strong> To analyze usage patterns, improve our Service, and develop new features</li>
                <li><strong>Security:</strong> To detect, prevent, and address fraud, security issues, and unauthorized access</li>
                <li><strong>Legal Compliance:</strong> To comply with legal obligations, enforce our terms, and respond to legal requests</li>
                <li><strong>Marketing:</strong> To send you promotional communications (with your consent) and for advertising purposes</li>
              </ul>
            </section>

            <section>
              <h2>4. How We Share Your Information</h2>
              <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
              
              <h3>4.1 Service Providers</h3>
              <p>We may share information with third-party service providers who perform services on our behalf, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Payment processors (Stripe, etc.)</li>
                <li>Cloud storage providers</li>
                <li>Analytics providers</li>
                <li>Email service providers</li>
                <li>Customer support platforms</li>
              </ul>

              <h3>4.2 Legal Requirements</h3>
              <p>We may disclose your information if required by law or in response to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Valid legal requests, subpoenas, or court orders</li>
                <li>Government investigations</li>
                <li>Protection of rights, property, or safety</li>
                <li>Enforcement of our Terms of Service</li>
              </ul>

              <h3>4.3 Business Transfers</h3>
              <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.</p>

              <h3>4.4 With Your Consent</h3>
              <p>We may share your information with third parties when you have given us explicit consent to do so.</p>
            </section>

            <section>
              <h2>5. Data Security</h2>
              <p>
                We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security assessments and updates</li>
                <li>Employee training on data protection</li>
              </ul>
              <p>
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2>6. Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to provide the Service, fulfill the purposes outlined in this Privacy Policy, comply with legal obligations, resolve disputes, and enforce our agreements.
              </p>
              <p>
                When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal, regulatory, or legitimate business purposes.
              </p>
            </section>

            <section>
              <h2>7. Your Rights and Choices</h2>
              <p>Depending on your location, you may have the following rights regarding your personal information:</p>
              
              <h3>7.1 Access and Portability</h3>
              <p>You have the right to access and receive a copy of your personal information in a portable format.</p>

              <h3>7.2 Correction</h3>
              <p>You can update or correct your personal information through your account settings or by contacting us.</p>

              <h3>7.3 Deletion</h3>
              <p>You can request deletion of your personal information by deleting your account or contacting us.</p>

              <h3>7.4 Opt-Out</h3>
              <p>You can opt out of marketing communications by using the unsubscribe link in emails or adjusting your notification preferences.</p>

              <h3>7.5 Objection and Restriction</h3>
              <p>You may object to certain processing of your information or request restriction of processing in certain circumstances.</p>

              <p className="mt-4">
                To exercise these rights, please contact us at <a href="mailto:support@blabber.ai" >support@blabber.ai</a>.
              </p>
            </section>

            <section>
              <h2>8. GDPR Compliance (EU Residents)</h2>
              <p>
                If you are a resident of the European Union, you have additional rights under the General Data Protection Regulation (GDPR):
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Right to access your personal data</li>
                <li>Right to rectification of inaccurate data</li>
                <li>Right to erasure (&quot;right to be forgotten&quot;)</li>
                <li>Right to restrict processing</li>
                <li>Right to data portability</li>
                <li>Right to object to processing</li>
                <li>Right to withdraw consent</li>
              </ul>
              <p>
                Our legal basis for processing your information includes: consent, contract performance, legal obligations, legitimate interests, and vital interests.
              </p>
            </section>

            <section>
              <h2>9. CCPA Compliance (California Residents)</h2>
              <p>
                If you are a California resident, you have rights under the California Consumer Privacy Act (CCPA):
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Right to know what personal information is collected, used, and shared</li>
                <li>Right to delete personal information</li>
                <li>Right to opt-out of the sale of personal information (we do not sell personal information)</li>
                <li>Right to non-discrimination for exercising your privacy rights</li>
              </ul>
              <p>
                California residents may request information about our data practices by contacting us at <a href="mailto:support@blabber.ai" >support@blabber.ai</a>.
              </p>
            </section>

            <section>
              <h2>10. Cookies and Tracking Technologies</h2>
              <p>
                We use cookies, web beacons, and similar tracking technologies to collect and store information about your use of the Service. Cookies are small data files stored on your device.
              </p>
              
              <h3>10.1 Types of Cookies We Use</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Essential Cookies:</strong> Required for the Service to function properly</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how users interact with the Service</li>
                <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
                <li><strong>Advertising Cookies:</strong> Used for targeted advertising and retargeting</li>
              </ul>

              <h3>10.2 Managing Cookies</h3>
              <p>
                You can control cookies through your browser settings. However, disabling cookies may affect the functionality of the Service.
              </p>
            </section>

            <section>
              <h2>11. Children&apos;s Privacy</h2>
              <p>
                The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected information from a child under 18, we will take steps to delete such information immediately.
              </p>
              <p>
                If you believe we have collected information from a child under 18, please contact us at <a href="mailto:support@blabber.ai" >support@blabber.ai</a>.
              </p>
            </section>

            <section>
              <h2>12. International Data Transfers</h2>
              <p>
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country.
              </p>
              <p>
                We ensure appropriate safeguards are in place for such transfers, including standard contractual clauses and other mechanisms as required by applicable law.
              </p>
            </section>

            <section>
              <h2>13. Third-Party Links</h2>
              <p>
                The Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read the privacy policies of any third-party services you access.
              </p>
            </section>

            <section>
              <h2>14. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
              </p>
              <p>
                We encourage you to review this Privacy Policy periodically. Your continued use of the Service after changes become effective constitutes acceptance of the updated Privacy Policy.
              </p>
            </section>

            <section>
              <h2>15. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <p>
                Email: <a href="mailto:support@blabber.ai" >support@blabber.ai</a>
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
