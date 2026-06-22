"use client";

import React from "react";
import { motion } from "framer-motion";
import { StatCard } from "../ui/StatCards";

export default function StatsSection(props: React.HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className="max-w-[1200px] mx-auto py-20 px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="inline-flex items-center space-x-2 px-4 py-2 mb-6 rounded-full border border-gray-200 text-foreground-700 hover:bg-gray-50 hover:text-background transition-colors duration-300"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="rotate-45"
            >
              <rect
                x="6"
                y="6"
                width="12"
                height="12"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <span className="text-caption font-medium">Why Blabber?</span>
          </motion.div>

          <motion.h2
            className="title-secondary"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            Built for Creators
            <br />
            Powered by AI
          </motion.h2>
        </div>

        <div className="flex items-end">
          <motion.p
            className="text-primary"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Blabber AI is the first creator platform with true AI voice cloning for calls, monetized messaging, and a built-in creator marketplace. Our multimodal AI remembers every fan, every conversation—text or voice. And with the lowest fees, you keep more of what you earn.
          </motion.p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        <StatCard
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16 8V6C16 4.93913 15.5786 3.92172 14.8284 3.17157C14.0783 2.42143 13.0609 2 12 2C10.9391 2 9.92172 2.42143 9.17157 3.17157C8.42143 3.92172 8 4.93913 8 6V8H16ZM6 8H18C18.5304 8 19.0391 8.21071 19.4142 8.58579C19.7893 8.96086 20 9.46957 20 10V20C20 20.5304 19.7893 21.0391 19.4142 21.4142C19.0391 21.7893 18.5304 22 18 22H6C5.46957 22 4.96086 21.7893 4.58579 21.4142C4.21071 21.0391 4 20.5304 4 20V10C4 9.46957 4.21071 8.96086 4.58579 8.58579C4.96086 8.21071 5.46957 8 6 8Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          stat="Lowest Fees"
          description="Blabber AI takes the smallest cut of subscription and PPV earnings—more for you, less for us."
        />

        <StatCard
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          stat="AI Voice Cloning & Memory"
          description="Monetize calls and messages with AI that remembers every fan, every conversation."
        />

        <StatCard
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12H22"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          stat="24/7 AI Earning"
          description="Your AI persona works around the clock—earn from calls and messages, even while you sleep."
        />
      </div>
    </section>
  );
}
