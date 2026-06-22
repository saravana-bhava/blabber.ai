"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useBetaMode } from "@/lib/contexts/beta-mode-context";
import { useBetaWaitlistDialog } from "@/lib/contexts/beta-waitlist-dialog-context";
import { Menu, X, Sun, Moon } from "lucide-react";
import { AnimatePresence, motion, easeInOut } from "framer-motion";
import { Button } from "../ui/button";
import Image from 'next/image';
import { useTheme } from "next-themes";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-8 h-8" />;
  }

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center justify-center rounded-full p-2 transition-colors hover:bg-black/10 dark:hover:bg-foreground/10"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className="w-5 h-5 text-pink-500" />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className="w-5 h-5 text-yellow-500" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const isBeta = useBetaMode();
  const waitlistDialog = useBetaWaitlistDialog();
  const isLanding = pathname === "/";
  const showPrimaryCta = !isBeta || isLanding;
  const primaryCtaHref = isBeta ? "/#beta-waitlist" : "/signup";
  const primaryCtaLabel = isBeta ? "JOIN BETA WAITLIST" : "SIGN IN";
  const handlePrimaryCta = isBeta ? () => waitlistDialog?.open() : undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close mobile menu when screen size changes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Add shadow on scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent body scrolling when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Animation variants for the mobile menu
  const menuVariants = {
    hidden: {
      opacity: 0,
      height: 0,
      transition: {
        duration: 0.3,
        ease: easeInOut,
        when: "beforeChildren",
        staggerChildren: 0.05,
        staggerDirection: 1,
      },
    },
    visible: {
      opacity: 1,
      height: "100vh",
      transition: {
        duration: 0.3,
        ease: easeInOut,
        when: "beforeChildren",
        staggerChildren: 0.05,
        delayChildren: 0.05,
      },
    },
  };

  // Updated animation variants for menu items to expand from center
  const itemVariants = {
    hidden: {
      opacity: 0,
      scaleX: 0, // Start with no width
      originX: 0.5, // Set origin to center
      transition: {
        duration: 0.2,
        ease: easeInOut,
      },
    },
    visible: {
      opacity: 1,
      scaleX: 1, // Expand to full width
      originX: 0.5, // Keep origin at center
      transition: {
        duration: 0.2,
        ease: easeInOut,
      },
    },
  };

  return (
    <nav
      className={`fixed w-full  z-50 transition-all duration-300 ${ scrolled ? "" : "" } ${ isOpen ? "bg-background px-0 pt-0" : "px-4 pt-4" }`}
    >
      <div className={`max-w-[1200px] mx-auto px-6 sm:px-6 lg:px-6 py-0 rounded-lg border border-foreground/10 backdrop-blur-md  ${ isOpen ? "bg-background" : "bg-foreground/2" }`}>
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-4xl font-bold">
              <Image 
                src="/logo.png" 
                alt="Blabber AI Logo" 
                width={130} 
                height={30} 
                className="object-contain cursor-pointer"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-10">
            <Link
              href="#real-ai"
              className="text-foreground hover:text-foreground/80 relative group"
            >
              Real AI
              <span
                className="absolute -bottom-1 left-1/2 right-1/2 w-0 h-[0.5] bg-foreground 
      transition-all duration-300 
      group-hover:left-0 group-hover:right-0 group-hover:w-full"
              ></span>
            </Link>
            <Link
              href="#why-us"
              className="text-foreground hover:text-foreground/80 relative group"
            >
              Why Us
              <span
                className="absolute -bottom-1 left-1/2 right-1/2 w-0 h-[0.5] bg-foreground 
      transition-all duration-300 
      group-hover:left-0 group-hover:right-0 group-hover:w-full"
              ></span>
            </Link>
            <Link
              href="#faqs"
              className="text-foreground hover:text-foreground/80 relative group"
            >
              FAQs
              <span
                className="absolute -bottom-1 left-1/2 right-1/2 w-0 h-[0.5] bg-foreground
      transition-all duration-300 
      group-hover:left-0 group-hover:right-0 group-hover:w-full"
              ></span>
            </Link>
            <Link
              href="/pricing"
              className="text-foreground hover:text-foreground/80 relative group"
            >
              Pricing
              <span
                className="absolute -bottom-1 left-1/2 right-1/2 w-0 h-[0.5] bg-foreground 
      transition-all duration-300 
      group-hover:left-0 group-hover:right-0 group-hover:w-full"
              ></span>
            </Link>
          </div>

          {/* Desktop: Theme toggle and CTA */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            {showPrimaryCta && (
              <Button
                href={primaryCtaHref}
                onClick={handlePrimaryCta}
                variant="filled"
                className="bg-pink-500 hover:bg-pink-600 text-white rounded-lg"
              >
                {primaryCtaLabel}
              </Button>
            )}
          </div>

          {/* Mobile: Theme toggle and hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-foreground-700 focus:outline-none"
              aria-expanded={isOpen}
              aria-label="Toggle menu"
            >
              <span className="sr-only">Open main menu</span>
              <AnimatePresence mode="wait" initial={false}>
                {isOpen ? (
                  <motion.div
                    key="close"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="block h-6 w-6" aria-hidden="true" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ opacity: 0, rotate: 90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="block h-6 w-6" aria-hidden="true" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu with animations */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed md:hidden inset-0 top-16 bg-background z-40 overflow-hidden"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={menuVariants}
          >
            <div className="flex flex-col items-center justify-center h-full pb-20 px-4 space-y-8">
              <motion.div
                variants={itemVariants}
                className="w-full flex justify-center"
              >
                <Link
                  href="#real-ai"
                  className="text-foreground hover:text-foreground/80 block px-3 py-3 text-2xl font-medium relative group text-center"
                  onClick={() => setIsOpen(false)}
                >
                  Real AI
                  <span className="absolute -bottom-1 left-1/4 right-1/4 w-1/2 h-0.5 bg-foreground scale-x-0 transition-transform duration-300 group-hover:scale-x-100"></span>
                </Link>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="w-full flex justify-center"
              >
                <Link
                  href="#why-us"
                  className="text-foreground hover:text-foreground/80 block px-3 py-3 text-2xl font-medium relative group text-center"
                  onClick={() => setIsOpen(false)}
                >
                  Why Us
                  <span className="absolute -bottom-1 left-1/4 right-1/4 w-1/2 h-0.5 bg-foreground scale-x-0 transition-transform duration-300 group-hover:scale-x-100"></span>
                </Link>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="w-full flex justify-center"
              >
                <Link
                  href="#faqs"
                  className="text-foreground hover:text-foreground/80 block px-3 py-3 text-2xl font-medium relative group text-center"
                  onClick={() => setIsOpen(false)}
                >
                  FAQs
                  <span className="absolute -bottom-1 left-1/4 right-1/4 w-1/2 h-0.5 bg-foreground scale-x-0 transition-transform duration-300 group-hover:scale-x-100"></span>
                </Link>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="w-full flex justify-center"
              >
                <Link
                  href="/pricing"
                  className="text-foreground hover:text-foreground/80 block px-3 py-3 text-2xl font-medium relative group text-center"
                  onClick={() => setIsOpen(false)}
                >
                  Pricing
                  <span className="absolute -bottom-1 left-1/4 right-1/4 w-1/2 h-0.5 bg-foreground scale-x-0 transition-transform duration-300 group-hover:scale-x-100"></span>
                </Link>
              </motion.div>

              {/* Primary CTA — Mobile */}
              {showPrimaryCta && (
                <motion.div variants={itemVariants} className="mt-6">
                  <Button
                    href={primaryCtaHref}
                    variant="filled"
                    size="lg"
                    className="bg-pink-500 hover:bg-pink-600"
                    rightIcon={
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    }
                    onClick={() => {
                      setIsOpen(false);
                      if (handlePrimaryCta) handlePrimaryCta();
                    }}
                  >
                    {primaryCtaLabel}
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
