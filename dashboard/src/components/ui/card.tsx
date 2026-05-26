import * as React from "react";
import { twMerge } from "tailwind-merge";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={twMerge(
        "rounded-2xl border border-border bg-card backdrop-blur-glass p-6 transition-all duration-300 hover:border-white/10 hover:shadow-[0_12px_24px_rgba(0,0,0,0.2)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={twMerge("flex flex-col space-y-1.5 pb-4", className)} {...props} />
);
CardHeader.displayName = "CardHeader";

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={twMerge("text-base font-bold uppercase tracking-wider text-muted", className)} {...props} />
);
CardTitle.displayName = "CardTitle";

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={twMerge("text-xs text-muted", className)} {...props} />
);
CardDescription.displayName = "CardDescription";

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={twMerge("pt-2", className)} {...props} />
);
CardContent.displayName = "CardContent";

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={twMerge("flex items-center pt-4 border-t border-border mt-4", className)} {...props} />
);
CardFooter.displayName = "CardFooter";
