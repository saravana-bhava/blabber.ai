"use client";
import React, { useEffect, useRef } from "react";
import { Button } from "../ui/button";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import Parallax from "@/components/front/animations/parallax";
import { useRive } from '@rive-app/react-canvas';
import { useBetaMode } from "@/lib/contexts/beta-mode-context";
import { useBetaWaitlistDialog } from "@/lib/contexts/beta-waitlist-dialog-context";

export default function HeroSection() {
  const isBeta = useBetaMode();
  const waitlistDialog = useBetaWaitlistDialog();

  useEffect(() => {
    document.body.style.overflowX = "hidden";
    return () => {
      document.body.style.overflowX = "";
    };
  }, []);

  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 0.3], [0, -30]);
  const riveScale = useTransform(scrollYProgress, [0, 0.8], [1, 1.8]);

  const { RiveComponent } = useRive({
    src: '/homepage.riv',
    stateMachines: 'social media state machine',
    autoplay: true,
  });

  return (
    <section
      ref={sectionRef}
      className="snap-section h-screen flex flex-col items-center justify-between pt-24 pb-24 sm:pt-24 px-6 sm:px-8 overflow-hidden relative"
    >
      {/* Static glows for better performance */}
      <div className=" absolute top-20 left-10 opacity-20 pointer-events-none animate-glow-1">
        <div className="w-64 h-64 rounded-full bg-gradient-to-r from-teal-200 to-blue-200 blur-2xl" />
      </div>

      <div className=" absolute bottom-40 right-10 opacity-20 pointer-events-none animate-glow-2">
        <div className="w-56 h-56 rounded-full bg-gradient-to-r from-purple-200 to-pink-200 blur-2xl" />
      </div>

      {/* Text Content - positioned in top half */}
      <div className="flex-1 flex items-center justify-center -mb-48 md:-mb-48">
        <Parallax speed={0.15} direction="up" className="z-10 w-full">
          <motion.div
            className="mx-auto flex flex-col items-center text-center max-w-[90%] sm:max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            style={{ y: textY }}
          >
            <motion.h1 className="title-primary mb-4">
              <motion.span
                className="block"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                viewport={{ once: true }}
              >
                Creator Economy 2.0
              </motion.span>
            </motion.h1>

            {/* <motion.p
              className="text-primary mb-0 sm:mb-0"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              viewport={{ once: true }}
            >
              Scale your fanbase, automate your convos, and turn every follower into income - without lifting a finger.
            </motion.p> */}

            <motion.p
              className="text-primary mb-6 sm:mb-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              viewport={{ once: true }}
            >
              The all-in-one monetization platform for modern creators.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                href={isBeta ? "/#beta-waitlist" : "/signup"}
                variant="filled"
                className="bg-pink-500 hover:bg-pink-600 text-white rounded-lg"
              >
                {isBeta ? "JOIN BETA WAITLIST" : "JOIN BLABBER AI"}
              </Button>
            </motion.div>
          </motion.div>
        </Parallax>
      </div>

      {/* Product Image - positioned in bottom half */}
      <div className="flex-1 flex items-center justify-center md:-mt-0 md:-mb-16">
        <Parallax
          speed={1}
          direction="down"
          className="w-full z-0"
        >
          <motion.div
            className="flex justify-center mx-auto relative"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.8,
              delay: 0.5,
              ease: [0.215, 0.61, 0.355, 1],
            }}
          >
            <motion.div
              className="relative w-full max-w-[600px] sm:max-w-2xl min-w-[400px]"
              style={{ scale: riveScale }}
            >
              <RiveComponent
                className="w-full h-[550px] max-w-[800px] min-w-[550px] object-contain"
                style={{ 
                  width: '100%', 
                  height: '550px'
                }}
              />
            </motion.div>

            {/* Simplified glow behind image */}
            <div className="hidden sm:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5 h-4/5 rounded-full bg-teal-400/10 blur-2xl -z-10" />
          </motion.div>
        </Parallax>
      </div>
    </section>
  );
}
