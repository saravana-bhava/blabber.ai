import Link from 'next/link';
import Image from 'next/image';
import { Image as ImageIcon } from 'lucide-react';

const LEGAL = ['Terms of Service', 'Privacy Policy', 'Refund Policy', 'Billing Support', 'Content Removal'];

export function LandingFooter() {
  return (
    <footer className="land-band-light pt-12 sm:pt-14">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-[34px] pb-8">
        <div className="land-foot-grid flex flex-wrap justify-between gap-8 sm:gap-10 pb-10 sm:pb-12">
          <div className="flex items-center gap-3 sm:gap-3.5 flex-wrap">
            <Image
              src="/logo.png"
              alt="Blabber"
              width={150}
              height={35}
              className="w-[150px] h-auto object-contain"
            />
            <span className="w-px h-[22px] bg-border hidden sm:block" />
            <span className="text-[13.5px] text-muted-foreground font-semibold">Next Generation Creator Platform</span>
          </div>
          <div className="flex gap-10 sm:gap-16">
            <div>
              <div className="font-bold text-sm mb-3">Company</div>
              <Link href="/help-center" className="block text-[13.5px] text-muted-foreground no-underline hover:text-foreground">
                Contact us
              </Link>
            </div>
            <div>
              <div className="font-bold text-sm mb-3">Legal</div>
              {LEGAL.map(l => (
                <Link
                  key={l}
                  href={l === 'Terms of Service' ? '/terms-of-service' : l === 'Privacy Policy' ? '/privacy-policy' : l === 'Refund Policy' ? '/refund-policy' : l === 'Content Removal' ? '/content-removal' : '#'}
                  className="block text-[13.5px] text-muted-foreground no-underline mb-2 hover:text-foreground"
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3.5 pt-5 sm:pt-[22px] border-t border-border">
          <div>
            <div className="text-[13px] text-muted-foreground">© 2026. All rights reserved. Blabber AI</div>
            <Link href="#" className="text-xs text-muted-foreground underline">
              18 U.S.C. 2257 Record-Keeping Requirements Compliance Statement
            </Link>
          </div>
          <div className="flex items-center gap-3.5 text-muted-foreground text-[13.5px]">
            <span>@blabber.ai</span>
            <span className="font-bold">𝕏</span>
            <ImageIcon size={16} />
          </div>
        </div>
      </div>
    </footer>
  );
}
