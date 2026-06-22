import React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Define button variants using class-variance-authority
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-medium transition-all duration-300 focus:outline-none active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:bg-foreground/90",
        outline:
          "border border-gray-300 text-gray-700 hover:bg-gray-50 hover:scale-105",
        filled: "bg-gray-900 text-white hover:bg-gray-800 hover:scale-105",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-9 px-4 py-2 text-sm",
        lg: "h-12 px-8 py-3",
      },
      hasIcon: {
        true: "gap-2",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      hasIcon: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  href?: string;
  rightIcon?: React.ReactNode;
  leftIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant,
      size,
      hasIcon,
      href,
      rightIcon,
      leftIcon,
      onClick,
      ...props
    },
    ref
  ) => {
    // If hasIcon is not explicitly set, determine it from rightIcon and leftIcon
    const hasIconValue = hasIcon ?? !!(rightIcon || leftIcon);

    const buttonClasses = cn(
      buttonVariants({ variant, size, hasIcon: hasIconValue, className })
    );

    // If href is provided, render as Link
    if (href) {
      return (
        <Link
          href={href}
          className={buttonClasses}
          onClick={onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        >
          {leftIcon}
          {children}
          {rightIcon}
        </Link>
      );
    }

    // Otherwise render as button
    return (
      <button className={buttonClasses} ref={ref} onClick={onClick} {...props}>
        {leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
