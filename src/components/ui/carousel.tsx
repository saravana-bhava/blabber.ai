'use client';

import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
// import type { EmblaOptionsType } from 'embla-carousel-react'; // Temporarily commenting out for type issue
import { RemoteImage } from '@/components/ui/remote-image';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

interface CarouselProps {
  images: { src: string; alt: string; aspectRatio?: number }[];
  options?: any;
  onImageClick?: (index: number) => void;
}

const Carousel: React.FC<CarouselProps> = ({ images, options, onImageClick }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(options);
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setPrevBtnDisabled(!emblaApi.canScrollPrev());
    setNextBtnDisabled(!emblaApi.canScrollNext());
    setCurrentIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  if (!images || images.length === 0) {
    return null;
  }

  const currentAspectRatio = images[currentIndex]?.aspectRatio || 100;

  return (
    <div className="relative w-full overflow-hidden group">
      <div 
        ref={emblaRef}
        className="relative"
        style={{ paddingBottom: `${currentAspectRatio}%` }}
      >
        <div className="absolute inset-0 flex">
          {images.map((image, index) => (
            <div 
              className="relative flex-[0_0_100%] min-w-0 cursor-pointer"
              key={index}
              onClick={() => onImageClick && onImageClick(index)}
            >
              <RemoteImage
                src={image.src}
                alt={image.alt}
                fill
                className="object-contain bg-muted/30"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          ))}
        </div>
      </div>
      {images.length > 1 && (
        <>
          <button
            onClick={scrollPrev}
            disabled={prevBtnDisabled}
            aria-label="Previous slide"
            className="absolute top-1/2 left-2 -translate-y-1/2 z-10 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full disabled:opacity-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <ChevronLeftIcon size={24} />
          </button>
          <button
            onClick={scrollNext}
            disabled={nextBtnDisabled}
            aria-label="Next slide"
            className="absolute top-1/2 right-2 -translate-y-1/2 z-10 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full disabled:opacity-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <ChevronRightIcon size={24} />
          </button>
        </>
      )}
    </div>
  );
};

export default Carousel; 