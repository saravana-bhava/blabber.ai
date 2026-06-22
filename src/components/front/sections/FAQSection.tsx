"use client";

import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion, easeInOut } from "framer-motion";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: easeInOut,
    },
  },
};

export default function FAQSection(props: React.HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className="grid items-start grid-cols-1 max-w-[1200px] pt-32 px-4 overflow-hidden mx-auto md:grid-cols-2 gap-20">
      <div className="flex flex-col gap-4 md:pr-8">
        <div>
          <motion.h3
            className="title-quinary mb-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            Blabber AI FAQ
          </motion.h3>
        </div>

        <div>
          <motion.h2
            className="title-secondary"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            About Blabber AI
          </motion.h2>
        </div>
      </div>

      <motion.div
        className="space-y-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        viewport={{ once: true }}
      >
        <Accordion type="single" collapsible className="w-full">
          {[
            {
              question: "What makes Blabber AI different from OnlyFans or Fanvue?",
              answer:
                "Blabber AI offers the lowest subscription and PPV fees, true AI voice cloning for monetized calls, AI-powered messaging, and a built-in creator marketplace. Our multimodal AI remembers every fan and every conversation—text or voice.",
            },
            {
              question: "How does AI voice cloning work for calls?",
              answer:
                "Our advanced AI voice cloning lets creators host monetized calls where fans interact with a lifelike AI version of their voice, unlocking new ways to earn and connect.",
            },
            {
              question: "Can I monetize my messages and conversations?",
              answer:
                "Yes! Blabber AI enables creators to earn from every message, with AI that remembers each fan and conversation for a truly personalized experience.",
            },
            {
              question: "What is the creator marketplace?",
              answer:
                "It's a built-in product marketplace—creators can sell directly to fans without the hassle of setting up their own shop.",
            },
            {
              question: "How do the AI agents remember conversations?",
              answer:
                "Our multimodal AI retains long-term memory across both text and voice, so every fan interaction is remembered and personalized, no matter how you connect."
            },
          ].map((item, idx) => (
            <AccordionItem
              key={idx}
              value={`item-${idx + 1}`}
              className="pb-6 mb-8"
            >
              <AccordionTrigger>
                <p className="faq-question text-left w-full">{item.question}</p>
              </AccordionTrigger>
              <AccordionContent>
                <motion.p
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  className="text-primary"
                >
                  {item.answer}
                </motion.p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </section>
  );
}
