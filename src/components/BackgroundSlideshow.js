import { useState, useEffect } from 'react';

const SLIDE_DURATION_MS = 8000;
const FADE_DURATION_MS = 1800;

const images = [
  '/backgrounds/Cobble17.jpg',
  '/backgrounds/Diamond Springs.jpg',
  '/backgrounds/Leatherstocking 18.jpeg',
  '/backgrounds/Mammoth 13.jpeg',
  '/backgrounds/PilgrimsRun.jpg',
  '/backgrounds/SV.jpeg',
  '/backgrounds/Smith Sign.jpg',
  '/backgrounds/TheHoot.jpg.webp',
  '/backgrounds/Atunyote.jpg.webp',
];

export default function BackgroundSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive(prev => (prev + 1) % images.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, [images.length]);

  // Safeguard in case the active state is out of bounds (e.g. during Hot Reload/Fast Refresh)
  const activeIndex = active >= images.length ? 0 : active;

  return (
    <>
      {images.map((src, i) => (
        <div
          key={src}
          className={`bg-slide kb-variant-${i % 5}`}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `url('${encodeURI(src)}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: i === activeIndex ? 1 : 0,
            zIndex: i === activeIndex ? 1 : 0,
            transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
          }}
        />
      ))}
    </>
  );
}
