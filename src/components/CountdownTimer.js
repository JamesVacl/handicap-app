import { useState, useEffect } from 'react';

const CountdownTimer = () => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isTimeReached, setIsTimeReached] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const tripDate = new Date('2025-08-08T07:00:00');
      const now = new Date();
      const difference = tripDate - now;

      if (difference <= 0) {
        setIsTimeReached(true);
        setTimeLeft('May the odds be ever in your favour 🏆 🏌️‍♂️');
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s until Guyscorp Open`);
    };

    calculateTime();
    // Update every second instead of every minute
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className={`countdown-timer ${isTimeReached ? 'celebration' : ''}`}>
      {timeLeft}
    </span>
  );
};

export default CountdownTimer;