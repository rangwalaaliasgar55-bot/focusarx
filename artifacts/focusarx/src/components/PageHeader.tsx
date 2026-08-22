import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  icon?: React.ReactNode;
  eyebrow?: string;
  badge?: string;
  badgeColor?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ icon, eyebrow, badge, title, subtitle, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("page-header-v3", className)}>
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-[var(--foreground-subtle)]">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
                {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
                {crumb.href ? <Link href={crumb.href} className="hover:text-[var(--foreground)]">{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="flex items-start gap-3">
          {icon && <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-lg)] border border-[var(--card-border)] bg-[var(--brand-soft)] text-[var(--brand-strong)] [&_svg]:size-5">{icon}</span>}
          <div className="min-w-0">
            {(eyebrow || badge) && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {eyebrow && <p className="page-eyebrow mb-0">{eyebrow}</p>}
                {badge && <Badge>{badge}</Badge>}
              </div>
            )}
            <h1 className="page-title-v3">{title}</h1>
            {subtitle && <p className="page-subtitle-v3">{subtitle}</p>}
          </div>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export default PageHeader;
