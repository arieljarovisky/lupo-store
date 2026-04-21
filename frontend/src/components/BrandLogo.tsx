import { Link } from 'react-router-dom';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
  to?: string;
}

export function BrandLogo({ compact = false, className = '', to = '/' }: BrandLogoProps) {
  const img = (
    <img
      src="/lupo-seeklogo.png"
      alt="Lupo"
      className={`${compact ? 'h-9 md:h-10' : 'h-10 md:h-11'} w-auto max-w-[min(100%,220px)] object-contain object-left ${className}`}
      loading="eager"
      decoding="async"
    />
  );

  if (!to) return img;
  return (
    <Link to={to} aria-label="Ir al inicio" className="inline-flex shrink-0">
      {img}
    </Link>
  );
}
