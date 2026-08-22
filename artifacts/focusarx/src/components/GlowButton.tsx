import { motion } from "framer-motion";
import { forwardRef } from "react";

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost" | "premium";
  size?: "sm" | "md" | "lg";
  glow?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variants = {
  primary: {
    base: "bg-gradient-to-br from-[var(--brand-600)] via-[var(--brand-500)] to-[var(--palette-4f46e5)] text-[var(--palette-white)] border-transparent",
    glow: "shadow-[0_0_24px_var(--rgba-124-58-237-0_3),0_4px_12px_var(--rgba-0-0-0-0_3)]",
    hover: "hover:shadow-[0_0_32px_var(--rgba-124-58-237-0_5),0_4px_16px_var(--rgba-0-0-0-0_4)] hover:brightness-110",
  },
  secondary: {
    base: "bg-[var(--rgba-124-58-237-0_1)] text-[var(--brand-400)] border-[var(--rgba-124-58-237-0_3)]",
    glow: "shadow-[0_0_12px_var(--rgba-124-58-237-0_15)]",
    hover: "hover:bg-[var(--rgba-124-58-237-0_18)] hover:shadow-[0_0_20px_var(--rgba-124-58-237-0_25)]",
  },
  danger: {
    base: "bg-[var(--rgba-239-68-68-0_12)] text-[var(--palette-f87171)] border-[var(--rgba-239-68-68-0_3)]",
    glow: "shadow-[0_0_12px_var(--rgba-239-68-68-0_15)]",
    hover: "hover:bg-[var(--rgba-239-68-68-0_2)] hover:shadow-[0_0_20px_var(--rgba-239-68-68-0_3)]",
  },
  success: {
    base: "bg-[var(--rgba-34-211-135-0_12)] text-[var(--palette-22d387)] border-[var(--rgba-34-211-135-0_3)]",
    glow: "shadow-[0_0_12px_var(--rgba-34-211-135-0_15)]",
    hover: "hover:bg-[var(--rgba-34-211-135-0_2)] hover:shadow-[0_0_20px_var(--rgba-34-211-135-0_3)]",
  },
  ghost: {
    base: "bg-transparent text-[var(--foreground-muted)] border-[var(--rgba-124-58-237-0_15)]",
    glow: "",
    hover: "hover:bg-[var(--rgba-124-58-237-0_08)] hover:text-[var(--foreground)]",
  },
  premium: {
    base: "bg-gradient-to-br from-[var(--brand-600)] via-[var(--brand-pink)] to-[var(--color-info)] text-[var(--palette-white)] border-transparent",
    glow: "shadow-[0_0_30px_var(--rgba-244-114-182-0_4),0_0_50px_var(--rgba-124-58-237-0_2)]",
    hover: "hover:scale-[1.04] hover:shadow-[0_0_40px_var(--rgba-244-114-182-0_6)] hover:brightness-110",
  },
};

const sizes = {
  sm: "text-xs px-3 py-1.5 rounded-lg",
  md: "text-sm px-4 py-2 rounded-xl",
  lg: "text-base px-6 py-3 rounded-xl",
};

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ variant = "primary", size = "md", glow = true, loading = false, icon, children, className = "", disabled, ...props }, ref) => {
    const v = variants[variant];
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        disabled={disabled || loading}
        className={`
          relative inline-flex items-center justify-center gap-2
          border font-semibold transition-all duration-[var(--duration-fast)]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${v.base} ${glow ? v.glow : ""} ${v.hover}
          ${sizes[size]} ${className}
        `}
        {...(props as any)}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-inherit">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </span>
        )}
        <span className={`flex items-center gap-2 ${loading ? "opacity-0" : ""}`}>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </span>
      </motion.button>
    );
  }
);

GlowButton.displayName = "GlowButton";
