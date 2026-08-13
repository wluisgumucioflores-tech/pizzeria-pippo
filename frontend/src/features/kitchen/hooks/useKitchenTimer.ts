"use client";

import { useState, useEffect } from "react";

export function useKitchenTimer(createdAt: string) {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const calc = () => {
      const created = new Date(createdAt).getTime();
      const now = Date.now();
      setMinutes(Math.max(0, Math.floor((now - created) / 60000)));
    };
    calc();
    const interval = setInterval(calc, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return minutes;
}
