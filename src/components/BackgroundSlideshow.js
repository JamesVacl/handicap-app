import { useState, useEffect } from 'react';

const SLIDE_DURATION_MS = 8000;
const FADE_DURATION_MS  = 1800;

const images = [
  '/backgrounds/Cobble17.jpg',
  '/backgrounds/Diamond Springs.jpg',
  '/backgrounds/Leatherstocking 18.jpeg',
  '/backgrounds/LoraBay6.jpeg',
  '/backgrounds/Mammoth 13.jpeg',
  '/backgrounds/PilgrimsRun.jpg',
  '/backgrounds/SV.jpeg',
  '/backgrounds/Smith Sign.jpg',
  '/backgrounds/TheHoot.jpg.webp',
  // HEIC last — Safari only, acts as a bonus slide on supported browsers
  '/backgrounds/Atunyote.heic',
];

export default function BackgroundSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive(prev => (prev + 1) % images.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, []);

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
            opacity: i === active ? 1 : 0,
            zIndex: i === active ? 1 : 0,
            transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
          }}
        />
      ))}
    </>
  );
}
