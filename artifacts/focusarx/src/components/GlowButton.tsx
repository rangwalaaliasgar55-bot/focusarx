import { motion } from "framer-motion";
import { forwardRef } from "react";

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  size?: "sm" | "md" | "lg";
  glow?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variants = {
  primary: {
    base: "bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white border-[rgba(124,58,237,0.5)]",
    glow: "shadow-[0_0_20px_rgba(124,58,237,0.4),0_4px_12px_rgba(0,0,0,0.3)]",
    hover: "hover:shadow-[0_0_32px_rgba(124,58,237,0.6),0_4px_16px_rgba(0,0,0,0.4)] hover:from-[#8B5CF6] hover:to-[#6366F1]",
  },
  secondary: {
    base: "bg-[rgba(124,58,237,0.1)] text-[#A78BFA] border-[rgba(124,58,237,0.3)]",
    glow: "shadow-[0_0_12px_rgba(124,58,237,0.15)]",
    hover: "hover:bg-[rgba(124,58,237,0.18)] hover:shadow-[0_0_20px_rgba(124,58,237,0.25)]",
  },
  danger: {
    base: "bg-[rgba(239,68,68,0.12)] text-[#F87171] border-[rgba(239,68,68,0.3)]",
    glow: "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
    hover: "hover:bg-[rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]",
  },
  success: {
    base: "bg-[rgba(34,211,135,0.12)] text-[#22d387] border-[rgba(34,211,135,0.3)]",
    glow: "shadow-[0_0_12px_rgba(34,211,135,0.15)]",
    hover: "hover:bg-[rgba(34,211,135,0.2)] hover:shadow-[0_0_20px_rgba(34,211,135,0.3)]",
  },
  ghost: {
    base: "bg-transparent text-[#94A3B8] border-[rgba(124,58,237,0.15)]",
    glow: "",
    hover: "hover:bg-[rgba(124,58,237,0.08)] hover:text-[#E2E8F0]",
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
          border font-semibold transition-all duration-200 
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
