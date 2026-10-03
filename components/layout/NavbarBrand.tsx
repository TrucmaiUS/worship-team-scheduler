'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const STATES = [
  { text: 'MUSIC MINISTRY', emoji: '🎵' },
  { text: 'SERVE TOGETHER',  emoji: '🙌' },
  { text: 'WORSHIP TOGETHER', emoji: '✝️' },
  { text: 'GOD IS GOOD',     emoji: '🙏' },
];

const CYCLE_INTERVAL = 3000; // auto-advance every 3s

interface NavbarBrandProps {
  href: string;
}

export function NavbarBrand({ href }: NavbarBrandProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0); // changing key re-mounts span → triggers animation
  const lastTapRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-cycle
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % STATES.length);
      setAnimKey(k => k + 1);
    }, CYCLE_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const advanceState = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIndex(prev => (prev + 1) % STATES.length);
    setAnimKey(k => k + 1);
    // restart timer from now
    timerRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % STATES.length);
      setAnimKey(k => k + 1);
    }, CYCLE_INTERVAL);
  }, []);

  const handleClick = useCallback(() => {
    const now = Date.now();
    const isMobile = window.matchMedia('(pointer: coarse)').matches;

    if (isMobile) {
      const timeSinceLast = now - lastTapRef.current;
      if (timeSinceLast < 1000 && lastTapRef.current !== 0) {
        // double tap within 1s → navigate
        router.push(href);
      } else {
        // first tap → cycle state
        advanceState();
      }
      lastTapRef.current = now;
    } else {
      // desktop → navigate immediately
      router.push(href);
    }
  }, [href, router, advanceState]);

  const current = STATES[index];

  return (
    <>
      <style>{`
        @keyframes brand-flip-in {
          0%   { opacity: 0; transform: translateY(-60%); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .brand-text-animate {
          display: inline-block;
          animation: brand-flip-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      <button
        onClick={handleClick}
        className="editorial-heading text-2xl md:text-3xl text-brand-black hover:text-brand-pink transition-colors flex items-center gap-1.5 select-none cursor-pointer bg-transparent border-0 p-0"
        aria-label="Music Ministry home"
      >
        {/* emoji: mobile only, stays still */}
        <span className="md:hidden text-xl leading-none" aria-hidden>
          {current.emoji}
        </span>

        {/* text: re-keyed to trigger animation on every change */}
        <span key={animKey} className="brand-text-animate overflow-hidden">
          {current.text}
        </span>
      </button>
    </>
  );
}
