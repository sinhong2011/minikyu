import { useEffect, useState } from 'react';
import { useAppReady } from '@/hooks/use-app-ready';

interface SplashScreenProps {
  children: React.ReactNode;
}

/**
 * Animated splash screen overlay that shows the Minikyu mascot
 * while the app initializes. Renders children immediately (so they
 * mount and initialize), and covers them with the overlay.
 * Once the app is ready, plays an exit animation and unmounts the overlay.
 */
export function SplashScreen({ children }: SplashScreenProps) {
  const isReady = useAppReady();
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (isReady && !isExiting) {
      setIsExiting(true);
    }
  }, [isReady, isExiting]);

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (isExiting && e.target === e.currentTarget) {
      setIsVisible(false);
    }
  };

  return (
    <>
      {children}
      {isVisible && (
        <div
          className="splash-backdrop fixed inset-0 z-50 flex items-center justify-center"
          data-exiting={isExiting}
          onAnimationEnd={handleAnimationEnd}
        >
          <div
            className="splash-window relative flex flex-col items-center justify-center overflow-hidden"
            style={{
              width: 320,
              height: 360,
              borderRadius: 28,
              background:
                'linear-gradient(135deg, rgba(26,17,36,0.45) 0%, rgba(11,10,18,0.5) 100%)',
              backdropFilter: 'blur(40px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
              boxShadow:
                '0 24px 80px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* Glass edge highlight */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                borderRadius: 28,
                border: '1px solid rgba(255,255,255,0.12)',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%, transparent 100%)',
              }}
            />

            {/* Aura glow behind mascot */}
            <div
              className="splash-aura absolute rounded-full"
              style={{
                width: 200,
                height: 200,
                background:
                  'radial-gradient(circle, rgba(255,122,89,0.15) 0%, rgba(255,59,110,0.08) 50%, transparent 70%)',
              }}
            />

            {/* Orbiting particles */}
            <div className="absolute" style={{ width: 240, height: 240 }}>
              {[
                { duration: '14s', delay: '0s', radius: 110, size: 5, color: '#FF7A59' },
                { duration: '18s', delay: '-4s', radius: 100, size: 3, color: '#FF3B6E' },
                { duration: '11s', delay: '-7s', radius: 115, size: 4, color: '#53A8FF' },
                { duration: '16s', delay: '-2s', radius: 105, size: 3, color: '#2B6BFF' },
                { duration: '20s', delay: '-9s', radius: 112, size: 3, color: '#FF7A59' },
              ].map((p, i) => (
                <div
                  key={i}
                  className="splash-orbit-ring absolute inset-0"
                  style={
                    {
                      '--orbit-duration': p.duration,
                    } as React.CSSProperties
                  }
                >
                  <div
                    className="splash-particle absolute rounded-full"
                    style={
                      {
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                        top: '50%',
                        left: '50%',
                        marginTop: -p.radius,
                        marginLeft: -p.size / 2,
                        '--particle-duration': `${2 + i * 0.4}s`,
                        '--particle-delay': p.delay,
                      } as React.CSSProperties
                    }
                  />
                </div>
              ))}
            </div>

            {/* Mascot mark - inlined SVG for individual group animation */}
            <div className="splash-mascot relative" style={{ width: 140, height: 140 }}>
              <svg
                width="140"
                height="140"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient
                    id="splash-bg"
                    x1="8"
                    y1="6"
                    x2="42"
                    y2="42"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#FF7A59" />
                    <stop offset="1" stopColor="#FF3B6E" />
                  </linearGradient>
                  <linearGradient
                    id="splash-panel"
                    x1="14"
                    y1="12"
                    x2="34"
                    y2="36"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#1A1124" />
                    <stop offset="1" stopColor="#0B0A12" />
                  </linearGradient>
                  <linearGradient
                    id="splash-book"
                    x1="19"
                    y1="28"
                    x2="29"
                    y2="37"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#53A8FF" />
                    <stop offset="1" stopColor="#2B6BFF" />
                  </linearGradient>
                </defs>

                {/* Background */}
                <rect x="2.5" y="2.5" width="43" height="43" rx="13" fill="url(#splash-bg)" />
                <rect
                  x="2.5"
                  y="2.5"
                  width="43"
                  height="43"
                  rx="13"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeOpacity="0.24"
                />

                {/* Panel */}
                <rect x="11" y="9.5" width="26" height="29" rx="8" fill="url(#splash-panel)" />
                <rect
                  x="11"
                  y="9.5"
                  width="26"
                  height="29"
                  rx="8"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeOpacity="0.2"
                />

                {/* Character group - floats */}
                <g className="splash-character">
                  {/* Face */}
                  <circle cx="24" cy="23" r="7.3" fill="#FFF7F2" />
                  {/* Eyes - blink independently */}
                  <g className="splash-eye">
                    <circle cx="21" cy="22.1" r="1" fill="#1A1124" />
                    <circle cx="27" cy="22.1" r="1" fill="#1A1124" />
                  </g>
                  {/* Smile */}
                  <path
                    d="M21.7 25.2c.9 1 3.8 1 4.7 0"
                    stroke="#2A1A30"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </g>

                {/* Book group - bobs independently */}
                <g className="splash-book">
                  <rect x="18" y="27.3" width="12" height="7.8" rx="2.4" fill="url(#splash-book)" />
                  <path d="M24 27.3v7.8" stroke="#DBEDFF" strokeOpacity="0.75" strokeWidth="0.7" />
                  <path
                    d="M20 29.8h2.8M20 31.6h3.6M25.5 29.8h2.8M25.5 31.6h2.1"
                    stroke="#ECF6FF"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                  />
                </g>
              </svg>
            </div>

            {/* Wordmark */}
            <p
              className="splash-wordmark mt-5 text-xl font-extrabold tracking-tight"
              style={{
                background: 'linear-gradient(90deg, #FF7A59, #FF3B6E, #6A78FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Minikyu
            </p>
          </div>
        </div>
      )}
    </>
  );
}
