import React, { useEffect, useMemo, useState } from 'react';
import { Store } from 'lucide-react';

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
  fallbackLabel?: string;
  onReportBroken?: () => void;
}

function imageCandidates(source: string): string[] {
  const optimized = source.replace(/=w\d+-h\d+(?:-[a-z0-9-]+)?$/i, '=w800-h600-k-no');
  const isGoogleImage = /^https:\/\/[^/]*googleusercontent\.com\//i.test(source);
  const direct = [source, ...(optimized !== source ? [optimized] : [])];
  if (!isGoogleImage || !import.meta.env.PROD) return direct;
  return [
    '/image?url=' + encodeURIComponent(source),
    ...(optimized !== source ? ['/image?url=' + encodeURIComponent(optimized)] : []),
    ...direct,
  ];
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackIcon,
  fallbackLabel,
  onReportBroken,
}: ImageWithFallbackProps) {
  const candidates = useMemo(() => (src ? imageCandidates(src) : []), [src]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [src]);

  if (!src || attempt >= candidates.length) {
    return (
      <div
        className={'flex flex-col items-center justify-center bg-surface-container text-primary/70 select-none ' + className}
        aria-label={alt}
      >
        {fallbackIcon ?? <Store className="w-7 h-7" />}
        {fallbackLabel && (
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1 px-1 text-center truncate max-w-full">
            {fallbackLabel}
          </span>
        )}
        {attempt >= candidates.length && src && onReportBroken && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onReportBroken();
            }}
            className="mt-1.5 px-2 py-0.5 rounded bg-surface-container-lowest/90 text-[10px] font-bold text-error hover:underline cursor-pointer"
          >
            Report broken photo
          </button>
        )}
      </div>
    );
  }

  return (
    <img
      key={candidates[attempt]}
      src={candidates[attempt]}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="strict-origin-when-cross-origin"
      onError={() => setAttempt((current) => current + 1)}
      className={'object-cover ' + className}
    />
  );
}
