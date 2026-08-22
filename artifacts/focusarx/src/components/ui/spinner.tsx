import { cn } from "@/lib/utils"

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
  label?: string
}

const sizeMap = {
  xs: "size-3 border-[1.5px]",
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-8 border-2",
}

/**
 * Spinner — consistent loading indicator using brand violet.
 */
function Spinner({ size = "md", className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block rounded-full border-solid",
        "border-[var(--rgba-124-58-237-0_20)] border-t-[var(--brand-violet)]",
        "animate-spin motion-reduce:animate-none",
        sizeMap[size],
        className
      )}
    />
  )
}

export { Spinner }
