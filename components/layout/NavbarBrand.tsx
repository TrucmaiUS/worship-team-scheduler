'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavbarBrandProps {
  href: string;
}

export function NavbarBrand({ href }: NavbarBrandProps) {
  const [isPressed, setIsPressed] = useState(false);
  const pathname = usePathname();

  // Reset pressed state when navigation completes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isPressed) {
      timeoutId = setTimeout(() => setIsPressed(false), 150);
    }
    return () => clearTimeout(timeoutId);
  }, [pathname, isPressed]);

  return (
    <Link
      href={href}
      onClick={() => setIsPressed(true)}
      className={`editorial-heading text-2xl md:text-3xl transition-colors select-none ${
        isPressed 
          ? 'text-brand-pink' 
          : 'text-brand-black hover:text-brand-pink active:text-brand-pink'
      }`}
    >
      MUSIC MINISTRY
    </Link>
  );
}
