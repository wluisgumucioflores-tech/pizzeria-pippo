"use client";

import { useEffect, useState } from "react";
import { KitchenService } from "../services/kitchen.service";
import { DEFAULT_STAGE_SETTINGS } from "../constants/kitchen-stage.constants";
import type { KitchenStageSettings } from "../types/kitchen.types";

export function useKitchenStageSettings(): KitchenStageSettings {
  const [settings, setSettings] = useState<KitchenStageSettings>(DEFAULT_STAGE_SETTINGS);

  useEffect(() => {
    KitchenService.getStageSettings().then((data) => {
      if (data) setSettings(data);
    });
  }, []);

  return settings;
}
