"use client";

import React from "react";

export function SpeakerPromoSection() {
  return (
    <section className="w-full py-20 px-6">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row md:items-start md:justify-between gap-12 md:gap-20">
        {/* Left Block: Title + Button */}
        <div className="flex flex-col justify-start space-y-6 md:max-w-[48%]">
          <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-bold leading-[1.2] tracking-tight text-foreground">
            Get your perfect
            <br />
            speaker now!
          </h2>
          <button
            type="button"
            className="inline-flex items-center justify-between px-6 sm:px-7 py-4 rounded-full bg-pink-500 hover:bg-pink-600 text-white font-medium text-[16px] cursor-pointer w-fit"
          >
            GET STARTED
            <span className="ml-3 w-10 h-10 flex items-center justify-center rounded-full bg-white text-black">
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
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </button>
        </div>

        {/* Right Block: Subtitle + Paragraph */}
        <div className="flex flex-col justify-start space-y-3 md:max-w-[48%]">
          <h3 className="text-[18px] sm:text-[20px] md:text-[24px] font-semibold text-foreground">
            Bring every room together
          </h3>
          <p className="text-[16px] sm:text-[17px] md:text-[18px] font-normal leading-[1.6] text-foreground/60">
            Experience our latest portable speaker innovation, delivering
            exceptional sound quality, unbeatable durability, and sleek design.
          </p>
        </div>
      </div>
    </section>
  );
}
