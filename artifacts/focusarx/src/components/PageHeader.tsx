import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  icon?: React.ReactNode;
  badge?: string;
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
  badgeColor = "#7C3AED",
  title,
  subtitle,
  breadcrumbs,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[#2D3748]">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={9} />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-[#4B5563] transition-colors">{crumb.label}</Link>
              ) : (
                <span className="text-[#4B5563]">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(135deg, ${badgeColor}33, ${badgeColor}11)`, border: `1px solid ${badgeColor}30` }}
            >
              {icon}
            </div>
          )}
          <div>
            {badge && (
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                style={{ background: `${badgeColor}15`, color: badgeColor, border: `1px solid ${badgeColor}25` }}>
                <span className="h-1 w-1 rounded-full animate-pulse" style={{ background: badgeColor }} />
                {badge}
              </div>
            )}
            <h1 className="text-2xl font-bold text-[#E2E8F0] tracking-tight leading-none sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-[13px] text-[#4B5563] leading-relaxed">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
