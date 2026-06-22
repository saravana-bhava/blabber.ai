import React from "react";
import Image from "next/image";
import type { StaticImageData } from "next/image";

interface BlogCardProps {
  title: string;
  date: string;
  imageSrc: string | StaticImageData;
}

export default function BlogCard({ title, date, imageSrc }: BlogCardProps) {
  if (!imageSrc) {
    console.error(`Missing imageSrc for blog card titled: ${title}`);
    return null;
  }

  return (
    <div className="w-full max-w-sm flex flex-col rounded-[20px]">
      <div className="relative w-full h-64 overflow-hidden rounded-[20px]">
        <Image src={imageSrc} alt={title} fill className="object-cover" />
      </div>
      <div className="mt-4">
        <h3 className="text-[20px] leading-[1.2] tracking-tight text-foreground mb-1">
          {title}
        </h3>
        <p className="text-[14px] leading-[1.5] font-sf-regular text-foreground/60">
          {date}
        </p>
      </div>
    </div>
  );
}
