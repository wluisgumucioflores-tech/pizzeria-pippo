"use client";

import { useEffect, useState } from "react";
import { getKitchenStage, type KitchenStage } from "../constants/kitchen-stage.constants";
import type { KitchenStageSettings } from "../types/kitchen.types";

const TICK_MS = 15000;

export function useOrderStage(
  createdAt: string,
  settings: KitchenStageSettings
): { minutes: number; stage: KitchenStage } {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const calc = () => {
      const created = new Date(createdAt).getTime();
      setMinutes(Math.floor((Date.now() - created) / 60000));
    };
    calc();
    const interval = setInterval(calc, TICK_MS);
    return () => clearInterval(interval);
  }, [createdAt]);

  return { minutes, stage: getKitchenStage(minutes, settings) };
}
