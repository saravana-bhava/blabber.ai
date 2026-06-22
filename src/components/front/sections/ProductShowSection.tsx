"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "../ui/Slider";
import TagButton from "../ui/TagButton";

export default function ProductShowSection() {
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = 3;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const imagePreviews = [
    "/Product-Show-1.png",
    "/Product-Show-2.png",
    "/Product-Show-3.png",
  ];

  return (
    <section className="max-w-[1200px] mx-auto py-20 px-4">
      {/* TEXT SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <TagButton
              label="In reality"
              withIcon
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="14" rx="2" ry="2" />
                  <path d="M7 21h10l-5-6z" />
                </svg>
              }
            />
          </motion.div>

          <motion.h2
            className="title-tertiary"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            Timeless Elegance
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
            Enhance your space with a perfect blend of modern design and warm
            ambiance. Our speaker bring style and sophistication
          </motion.p>
        </div>
      </div>

      <div className="relative w-full max-w-[1440px] mx-auto rounded-2xl shadow-xl overflow-hidden">
        {/* AnimatePresence for exit/enter transitions */}
        <AnimatePresence mode="wait">
          <motion.img
            key={currentPage}
            src={imagePreviews[currentPage]}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-full h-auto object-cover rounded-2xl"
          />
        </AnimatePresence>

        {/* Thumbnails (Slider) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
          <Slider
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            imagePreviews={imagePreviews}
          />
        </div>
      </div>
    </section>
  );
}
