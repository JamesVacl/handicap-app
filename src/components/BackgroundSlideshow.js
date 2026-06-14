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

// These match the 0% keyframe of each kb-variant in globals.css exactly.
// A slide gets this transform applied as an inline style while fading in,
// so when the animation class takes over it starts from the identical position
// — eliminating the snap/jolt between "no transform" and the animation start.
const KB_INITIAL_TRANSFORMS = [
  'scale(1.08) translate(0%, 0%)',    // kb0
  'scale(1.1)  translate(2%, -1%)',   // kb1
  'scale(1.09) translate(-2%, 1%)',   // kb2
  'scale(1.08) translate(1.5%, 2%)', // kb3
  'scale(1.1)  translate(-1%, -2%)', // kb4
];

export default function BackgroundSlideshow() {
  // `active`    — which slide is visible (controls opacity/z-index)
  // `animated`  — which slide runs the Ken Burns motion (lags by FADE_DURATION_MS)
  // This means: fade-in finishes first, then the pan/zoom starts.
  const [active, setActive] = useState(0);
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % images.length;
        // Delay applying the Ken Burns class until the crossfade is done
        setTimeout(() => setAnimated(next), FADE_DURATION_MS);
        return next;
      });
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, []);

  const activeIndex   = active   >= images.length ? 0 : active;
  const animatedIndex = animated >= images.length ? 0 : animated;

  return (
    <>
      {images.map((src, i) => {
        const isActive   = i === activeIndex;
        const isAnimated = i === animatedIndex;
        const variantIndex = i % 5;

        return (
          <div
            key={src}
            // Ken Burns class only applied once the fade has completed
            className={isAnimated ? `bg-slide kb-variant-${variantIndex}` : 'bg-slide'}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundImage: `url('${encodeURI(src)}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: isActive ? 1 : 0,
              zIndex: isActive ? 1 : 0,
              transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
              // Pre-position the slide at its animation's 0% transform while it's
              // fading in (isActive but not yet isAnimated). When the kb class is
              // added the animation picks up from this exact position → no jolt.
              // Once the animation class is active, CSS takes over (no inline needed).
              transform: !isAnimated ? KB_INITIAL_TRANSFORMS[variantIndex] : undefined,
            }}
          />
        );
      })}
    </>
  );
}
