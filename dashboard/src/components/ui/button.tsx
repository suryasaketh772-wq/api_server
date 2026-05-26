import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        className={twMerge(
          "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          // Variants
          variant === "primary" && "bg-gold-gradient text-background hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] text-black bg-gradient-to-r from-gold-primary to-gold-dark hover:from-gold-light hover:to-gold-primary",
          variant === "secondary" && "bg-white/5 border border-border text-foreground hover:bg-white/10 hover:border-white/20",
          variant === "danger" && "bg-red-accent/15 border border-red-accent/30 text-red-accent hover:bg-red-accent/25",
          variant === "outline" && "border border-gold-primary/30 text-gold-primary hover:bg-gold-primary/10 hover:border-gold-primary/60",
          variant === "ghost" && "text-muted hover:bg-white/5 hover:text-foreground",
          // Sizes
          size === "sm" && "px-3 py-1.5 text-xs",
          size === "md" && "px-4 py-2 text-sm",
          size === "lg" && "px-6 py-3 text-base",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
