
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

const buttonVariants = cva(
  "apple-ui-btn inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_2px_10px_hsl(var(--primary)/0.28),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:bg-primary/90 hover:shadow-[0_4px_16px_hsl(var(--primary)/0.38),inset_0_1px_1px_rgba(255,255,255,0.5)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_2px_10px_hsl(var(--destructive)/0.28),inset_0_1px_1px_rgba(255,255,255,0.35)] hover:bg-destructive/90",
        outline:
          "border border-input/80 bg-white/75 dark:bg-zinc-900/60 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] hover:bg-white/95 dark:hover:bg-zinc-800/80 hover:text-foreground",
        secondary:
          "bg-secondary/85 backdrop-blur-md text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] hover:bg-secondary",
        ghost: "hover:bg-muted/70 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-7 rounded-lg px-2 text-xs",
        sm: "h-9 rounded-xl px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          children
        )}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
