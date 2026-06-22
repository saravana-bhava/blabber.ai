"use client";

import { useEffect } from "react";

export default function SmoothScroll() {
  useEffect(() => {
    // Import Lenis dynamically to avoid SSR issues
    const setupLenis = async () => {
      const Lenis = (await import("lenis")).default;

      const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
        // Smooth inertia that feels natural
        syncTouch: true,
        // Allow native scroll for modal content
        prevent: (node) => node?.classList?.contains('no-lenis') || node?.hasAttribute('data-lenis-prevent'),
      });

      function raf(time: number) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }

      requestAnimationFrame(raf);

      // Add necessary CSS classes to the document
      document.documentElement.classList.add("lenis", "lenis-smooth");

      return () => {
        lenis.destroy();
        document.documentElement.classList.remove("lenis", "lenis-smooth");
      };
    };

    const cleanup = setupLenis();
    return () => {
      cleanup.then((cleanupFn) => cleanupFn && cleanupFn());
    };
  }, []);

  return null;
}
