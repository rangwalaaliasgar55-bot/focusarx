import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-[1.6875rem] w-[2.8125rem] shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] after:absolute after:-inset-y-2.5 after:-inset-x-0.5 transition-colors duration-[var(--duration-normal)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--success)] data-[state=unchecked]:bg-[var(--palette-black)]/[0.14] dark:data-[state=unchecked]:bg-white/15",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-6 w-6 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25),0_1px_1px_rgba(0,0,0,0.15)] ring-0 transition-transform duration-[var(--duration-normal)] ease-[var(--ease-spring)] data-[state=checked]:translate-x-[1.125rem] data-[state=unchecked]:translate-x-0.5"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
