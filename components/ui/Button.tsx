import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "sticker"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap text-sm font-bold ring-offset-background transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 uppercase tracking-widest",
          {
            "bg-brand-blue text-brand-white hover:bg-blue-700": variant === "primary",
            "bg-brand-pink text-brand-white hover:bg-pink-600": variant === "secondary",
            "border-4 border-brand-black bg-transparent hover:bg-brand-black hover:text-brand-cream": variant === "outline",
            "bg-transparent text-brand-black hover:bg-black/5": variant === "ghost",
            "sticker-card text-brand-black": variant === "sticker",
            "h-10 px-6 py-2": size === "default",
            "h-9 px-4": size === "sm",
            "h-14 px-10 py-4 text-lg": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
