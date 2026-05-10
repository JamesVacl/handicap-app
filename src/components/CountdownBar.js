import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const CountdownBar = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isTimeReached, setIsTimeReached] = useState(false);
  const [visible, setVisible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const calculateTime = () => {
      const tripDate = new Date('2026-08-14T07:00:00');
      const now = new Date();
      const difference = tripDate - now;

      if (difference <= 0) {
        setIsTimeReached(true);
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="countdown-bar" onClick={() => router.push('/schedule')}>
      <div className="countdown-bar-inner">
        {isTimeReached ? (
          <span className="countdown-bar-celebration">
            🏆 May the odds be ever in your favour 🏌️‍♂️
          </span>
        ) : (
          <>
            <span className="countdown-bar-label">⛳ Guyscorp Open</span>
            <div className="countdown-bar-units">
              <div className="countdown-unit">
                <span className="unit-value">{timeLeft.days}</span>
                <span className="unit-label">days</span>
              </div>
              <div className="countdown-separator">:</div>
              <div className="countdown-unit">
                <span className="unit-value">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="unit-label">hrs</span>
              </div>
              <div className="countdown-separator">:</div>
              <div className="countdown-unit">
                <span className="unit-value">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="unit-label">min</span>
              </div>
              <div className="countdown-separator">:</div>
              <div className="countdown-unit">
                <span className="unit-value">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <span className="unit-label">sec</span>
              </div>
            </div>
            <span className="countdown-bar-cta">View Schedule →</span>
          </>
        )}
      </div>
      <button
        className="countdown-bar-dismiss"
        onClick={(e) => { e.stopPropagation(); setVisible(false); }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
};

export default CountdownBar;
