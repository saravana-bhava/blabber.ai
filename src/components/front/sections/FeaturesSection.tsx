"use client";
import React from "react";
import Image from "next/image";
import { Button } from "../ui/button";
import { useBetaMode } from "@/lib/contexts/beta-mode-context";
import { useBetaWaitlistDialog } from "@/lib/contexts/beta-waitlist-dialog-context";

const features = [
  {
    tag: "Lowest Fees",
    title: "Keep More Earnings",
    description:
      "You keep 90% on subscriptions, tips, and PPVs—the lowest fees in the industry. Keep more of what you earn.",
    image: "/front_pay.jpg",
  },
  {
    tag: "AI Voice & Chat",
    title:
      "Monetize Every Conversation",
    description:
      "Host calls and send messages—let your AI-powered persona earn for you, 24/7.",
    image: "/front_ai.jpg",
  },
  {
    tag: "Marketplace",
    title: "Sell Products Instantly",
    description:
      "A built-in product marketplace—no need to set up your own shop. Sell directly to your fans, hassle-free.",
    image: "/front_market.jpg",
  },
];

export default function FeaturesSection(props: React.HTMLAttributes<HTMLElement>) {
  const isBeta = useBetaMode();
  const waitlistDialog = useBetaWaitlistDialog();

  return (
    <section {...props} className="flex flex-col items-center pt-32 pb-32 px-4 gap-20 overflow-hidden">
      {features.map((feature, index) => {
        const isEven = index % 2 === 0;

        return (
          <div
            key={index}
            className="grid grid-cols-1 md:grid-cols-2 items-center gap-12 max-w-[1200px] mx-auto"
          >
            {/* Image */}
            <div
              className={`order-1 ${
                isEven ? "md:order-2" : "md:order-1"
              } w-full`}
            >
              <Image
                src={feature.image}
                alt={feature.tag}
                width={800}
                height={800}
                className="object-cover w-full h-auto border border-foreground/10 rounded-2xl"
              />
            </div>

            {/* Text */}
            <div
              className={`order-2 ${
                isEven ? "md:order-1" : "md:order-2"
              } flex flex-col items-start justify-center gap-4 md:gap-6`}
            >
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-600"
                >
                  <path d="M2 10v3" />
                  <path d="M6 6v11" />
                  <path d="M10 3v18" />
                  <path d="M14 8v7" />
                  <path d="M18 5v13" />
                  <path d="M22 10v3" />
                </svg>
                <span className="text-highlight">{feature.tag}</span>
              </div>

              <h2 className="title-tertiary">{feature.title}</h2>
              <p className="text-primary">{feature.description}</p>

              <Button
                href={isBeta ? "/#beta-waitlist" : "/signup"}
                className="bg-pink-500 hover:bg-pink-600 text-white rounded-lg"
                variant="filled"
              >
                {isBeta ? "JOIN BETA WAITLIST" : "JOIN BLABBER AI"}
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
