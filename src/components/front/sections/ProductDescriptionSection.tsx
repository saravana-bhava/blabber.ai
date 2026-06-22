"use client";
import React from "react";
import { motion } from "framer-motion";

export default function ProductDescriptionSection() {
  return (
    <div className="flex m-0 w-full items-center justify-center px-4 py-8">
      <motion.h1
        className="text-center text-[28px] sm:text-5xl font-extrabold leading-tight"
        initial={{ opacity: 0, y: 20, scale: 1.5 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
      >
        The Creator Platform, Reinvented
      </motion.h1>
    </div>
  );
}
