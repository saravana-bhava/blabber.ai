import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from '@/lib/contexts/user-context';
import { PulseUIProvider } from '@/lib/contexts/pulse-ui-context';
import { CreditsModalProvider } from '@/lib/contexts/credits-modal-context';
import { MobileNav } from "@/components/layout/mobile-nav";
import { ClientLayout } from "@/components/layout/client-layout";
import { BetaModeProvider } from "@/lib/contexts/beta-mode-context";
import { BetaWaitlistDialogProvider } from "@/lib/contexts/beta-waitlist-dialog-context";
import { BetaWaitlistDialog } from "@/components/front/BetaWaitlistDialog";
import { CreditMonetizationProvider } from "@/lib/contexts/credit-monetization-context";
import { getIsBeta } from "@/lib/env/is-beta";
import { ReactQueryProvider } from "@/lib/query/providers";
import { PostHogProvider } from "@/components/providers/PostHogProvider";

export const metadata: Metadata = {
  title: "Blabber",
  description: "A new social media platform by Blabber AI",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isBeta = getIsBeta();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />

        {/* <!-- Open Graph --> */}
        <meta property="og:title" content="Blabber" />
        <meta property="og:description" content="A social media platform for creators and fans" />
        <meta property="og:image" content="https://blabber.ai/blabber-og.png" />
        <meta property="og:type" content="website" />

        {/* <!-- Twitter Card --> */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Blabber" />
        <meta name="twitter:description" content="A social media platform for creators and fans" />
        <meta name="twitter:image" content="https://blabber.ai/blabber-og.png" />
      </head>
      <body
        className="md:min-h-screen font-sans text-[15px] leading-normal antialiased"
      >
        <PostHogProvider>
        <ReactQueryProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <BetaModeProvider value={isBeta}>
            <BetaWaitlistDialogProvider>
              <UserProvider>
                <CreditMonetizationProvider>
                  <PulseUIProvider>
                    <CreditsModalProvider>
                      <ClientLayout>
                        {children}
                      </ClientLayout>
                    </CreditsModalProvider>
                  </PulseUIProvider>
                </CreditMonetizationProvider>
              </UserProvider>
              {isBeta ? <BetaWaitlistDialog /> : null}
            </BetaWaitlistDialogProvider>
          </BetaModeProvider>
        </ThemeProvider>
        </ReactQueryProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
