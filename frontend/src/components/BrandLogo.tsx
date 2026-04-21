import { Link } from 'react-router-dom';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
  to?: string;
}

export function BrandLogo({ compact = false, className = '', to = '/' }: BrandLogoProps) {
  const content = (
    <span className={`inline-flex items-center ${compact ? 'gap-2' : 'gap-3'} ${className}`}>
      <img
        src="/lupo-seeklogo.png"
        alt="Lupo Store"
        className={compact ? 'h-8 w-auto' : 'h-10 w-auto'}
        loading="eager"
      />
      <span className="leading-none">
        <strong className="block text-[14px] md:text-[15px] uppercase tracking-[0.18em] text-lupo-ink">
          Lupo Store
        </strong>
        <span className="block text-[10px] uppercase tracking-[0.18em] text-lupo-slate">
          Innerwear and sportwear
        </span>
      </span>
    </span>
  );

  if (!to) return content;
  return (
    <Link to={to} aria-label="Ir al inicio">
      {content}
    </Link>
  );
}
