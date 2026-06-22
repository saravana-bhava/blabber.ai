"use client";

import { cn } from "@/lib/utils";

interface SliderProps {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  className?: string;
  imagePreviews: string[];
}

export function Slider({
  totalPages,
  currentPage,
  onPageChange,
  className,
  imagePreviews,
}: SliderProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {Array.from({ length: totalPages }).map((_, index) => (
        <button
          key={index}
          onClick={() => onPageChange(index)}
          className={cn(
            "w-[60px] h-[40px] rounded-md overflow-hidden border transition-all",
            currentPage === index
              ? "border-gray-400 opacity-100 shadow-md"
              : "border-gray-200 opacity-50 hover:opacity-75"
          )}
          aria-label={`Go to page ${index + 1}`}
          aria-current={currentPage === index ? "page" : undefined}
        >
          <img
            src={imagePreviews[index]}
            alt={`Preview ${index + 1}`}
            className="w-full h-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}
