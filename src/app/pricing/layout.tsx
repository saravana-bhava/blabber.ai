import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pricing — Blabber",
  description:
    "Creator revenue splits and fan credit bundles. Industry-low fees with transparent AI credit pricing.",
};

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
