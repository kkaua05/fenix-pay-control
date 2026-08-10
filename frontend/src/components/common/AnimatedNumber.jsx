import { useEffect, useRef, useState } from 'react';

const AnimatedNumber = ({ value = 0, duration = 800, formatter, decimals = 0 }) => {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const rounded = decimals > 0 ? Number(display.toFixed(decimals)) : Math.round(display);
  return <span>{formatter ? formatter(rounded) : rounded}</span>;
};

export default AnimatedNumber;
