import React, { useState } from "react";
import Link from "next/link";
import { Instagram, X } from "lucide-react";
import Image from 'next/image';

export default function Footer() {
  const [modal, setModal] = useState<null | 'contact' | 'terms' | 'privacy'>(null);

  return (
    <footer className="bg-foreground text-background px-8 md:px-20 pt-16 pb-12 relative overflow-hidden flex flex-col gap-20">
      {/* Top Row */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-12">
        {/* Logo and Slogan */}
        <div className="flex items-center gap-3">
              <Image 
                src="/logo.png" 
                alt="Blabber AI Logo" 
                width={130} 
                height={30} 
                className="object-contain cursor-pointer"
              />
          <div className="w-px h-5 bg-gray-600" />
          <p className="text-sm text-background/80">Next Generation Creator Platform</p>
        </div>
        {/* Company */}
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-sm">Company</h3>
          <button
            onClick={() => setModal('contact')}
            className="text-sm text-background/60 hover:text-background transition text-left"
          >
            Contact us
          </button>
        </div>
        {/* Legal */}
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-sm">Legal</h3>
          <Link
            href="/terms-of-service"
            className="text-sm text-background/60 hover:text-background transition text-left"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy-policy"
            className="text-sm text-background/60 hover:text-background transition text-left"
          >
            Privacy Policy
          </Link>
          <Link
            href="/refund-policy"
            className="text-sm text-background/60 hover:text-background transition text-left"
          >
            Refund Policy
          </Link>
          <a
            href="https://epoch.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-background/60 hover:text-background transition text-left"
          >
            Billing Support
          </a>
          <Link
            href="/content-removal"
            className="text-sm text-background/60 hover:text-background transition text-left"
          >
            Content Removal
          </Link>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-background/40 text-sm gap-4">
          <p>© 2025. All rights reserved. Blabber AI</p>

          {/* Socials */}
          <div className="flex items-center gap-4">
            <span>@blabber.app</span>
            <a href="https://x.com/blabber_ai" className="hover:text-background transition">
              <X size={18} />
            </a>
            <a href="https://instagram.com/blabber.app" className="hover:text-background transition">
              <Instagram size={18} />
            </a>
          </div>
        </div>
        {/* Fine Print */}
        <div className="text-background/30 text-xs">
          <Link
            href="/custodian-of-records"
            className="hover:text-background/50 transition underline"
          >
            18 U.S.C. 2257 Record-Keeping Requirements Compliance Statement
          </Link>
        </div>
      </div>

      {/* Modals */}
      {modal === 'contact' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background text-foreground rounded-lg p-8 max-w-md w-full relative">
            <button onClick={() => setModal(null)} className="absolute top-2 right-2 text-xl">×</button>
            <h2 className="text-lg font-bold mb-2">Contact Us</h2>
            <p className="mb-4">We&rsquo;d love to hear from you! For inquiries, email <a href="mailto:support@blabber.ai" className="underline">support@blabber.ai</a></p>
          </div>
        </div>
      )}
      {modal === 'terms' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-background text-foreground rounded-lg p-8 max-w-md w-full max-h-[90vh] overflow-y-auto relative no-lenis">
            <button onClick={() => setModal(null)} className="absolute top-2 right-2 text-xl">×</button>
            <h2 className="text-lg font-bold mb-2">Terms of Service</h2>
            <div className="mb-4 text-sm space-y-2">
              <p><strong>Welcome to Blabber AI!</strong></p>
              <p>By using our platform, you agree to our legal policies which govern your rights and responsibilities. Please review these key documents carefully.</p>

              <p><strong>1. Terms of Service:</strong> Our terms bind all creators and fans to our platform rules. They cover your responsibilities, include an arbitration clause, and limit our liability. Crucially, these terms clarify that Blabber AI is not liable for user-generated content and that no employment relationship exists between Blabber AI and our creators. For more details, please see our full <a href="#" target="_blank">Terms of Service</a>.</p>

              <p><strong>2. Privacy Policy:</strong> Your privacy is a priority. Our policy explains how we collect, store, and use data, including personal details, voice/chat logs, and billing information. Our practices are designed to be compliant with GDPR and CCPA for residents of the EU and California. Learn more in our <a href="#" target="_blank">Privacy Policy</a>.</p>
              
              <p><strong>3. Community &amp; Content Guidelines:</strong> To protect our community, we have clear guidelines on what is and isn&apos;t allowed. This includes prohibitions against nudity, hate speech, illegal activity, and misuse of our AI. All users are expected to adhere to our <a href="#" target="_blank">Community Guidelines</a>.</p>

              <p><strong>4. Age &amp; 18+ Disclaimer:</strong> This platform is for users 18 years of age and older only. By using this site, you confirm that you are of legal adult age in your jurisdiction. Please review our <a href="#" target="_blank">Age Verification Policy</a>.</p>

              <p><strong>5. Earnings Disclaimer:</strong> For creators using our monetization tools, we do not guarantee any level of income. You are fully responsible for your own earnings. See our <a href="#" target="_blank">Earnings Disclaimer</a> for more information.</p>

              <p><strong>6. DMCA &amp; Copyright Policy:</strong> We comply with copyright law and provide a process for users to file copyright claims or takedown requests for content uploaded to our platform. If you believe your copyright has been infringed, please follow our <a href="#" target="_blank">DMCA Policy</a>.</p>

              <p><strong>7. Cookie Policy:</strong> We use cookies to improve your experience and for analytics. By using Blabber AI, you consent to our use of cookies. <a href="#" target="_blank">Learn more</a>.</p>

              <p><strong>8. Contact Us:</strong> For any questions, support needs, or legal inquiries, please contact our team via our in-app ticket system or email us at <a href="mailto:support@blabber.ai">support@blabber.ai</a>.</p>
            </div>
          </div>
        </div>
      )}
      {modal === 'privacy' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-background text-foreground rounded-lg p-8 max-w-md w-full max-h-[90vh] overflow-y-auto relative no-lenis">
            <button onClick={() => setModal(null)} className="absolute top-2 right-2 text-xl">×</button>
            <h2 className="text-lg font-bold mb-2">Privacy Policy</h2>
            <div className="mb-4 text-sm space-y-2">
              <p><strong>Your Privacy at Blabber AI</strong></p>
              <p>Protecting your data is fundamental to our service. This summary explains our practices, which are detailed in our full Privacy Policy. By using Blabber AI, you agree to the data practices described below.</p>

              <p><strong>1. How We Collect &amp; Use Data:</strong> We collect the information necessary to provide and improve our service. This includes personal data (like your name and email), billing and payment information, and content data, such as <strong>voice and chat logs</strong> from your interactions on the platform. This data is used for service delivery, platform improvement, and security.</p>

              <p><strong>2. Data Sharing and Storage:</strong> We do not sell your personal data. We may share information with trusted third-party partners for essential functions like payment processing. All data is stored using appropriate security measures to prevent unauthorized access.</p>
              
              <p><strong>3. GDPR &amp; CCPA Compliance:</strong> If you are a resident of the European Union or California, you have specific rights under GDPR and CCPA. These include the right to access, correct, delete, or port your personal data. We are committed to upholding these rights.</p>

              <p><strong>4. Cookies and Tracking:</strong> We use cookies to operate the site, analyze user activity, and for tracking purposes which may include retargeting. You can learn more about how we use them and how to manage your preferences in our full <a href="#" target="_blank">Cookie Policy</a>.</p>

              <p>If you have any questions, you can reach our team at <a href="mailto:support@blabber.ai">support@blabber.ai</a>.</p>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
