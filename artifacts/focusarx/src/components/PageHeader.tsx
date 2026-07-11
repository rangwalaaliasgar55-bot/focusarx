import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  icon?: React.ReactNode;
  badge?: string;
  /** CSS color value — controls badge accent. Defaults to brand violet. */
  badgeColor?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  icon,
  badge,
  badgeColor = "var(--brand-violet)",
  title,
  subtitle,
  breadcrumbs,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-3">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
              {i > 0 && <ChevronRight size={9} className="text-[var(--foreground-subtle)]" />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-[var(--foreground-muted)] transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[var(--foreground-muted)]">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Icon badge */}
          {icon && (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)]"
              style={{
                background: `color-mix(in srgb, ${badgeColor} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${badgeColor} 22%, transparent)`,
              }}
            >
              {icon}
            </div>
          )}

          <div>
            {/* Live badge */}
            {badge && (
              <div
                className="mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                style={{
                  background: `color-mix(in srgb, ${badgeColor} 12%, transparent)`,
                  color: badgeColor,
                  border: `1px solid color-mix(in srgb, ${badgeColor} 22%, transparent)`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: badgeColor }}
                />
                {badge}
              </div>
            )}

            <h1 className="text-h2 text-[var(--foreground)]">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 text-sm text-[var(--foreground-muted)] leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
