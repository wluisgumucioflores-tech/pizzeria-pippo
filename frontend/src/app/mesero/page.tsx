"use client";

import { MeseroNameGate } from "@/features/mesero/components/MeseroNameGate";
import { MeseroPageContent } from "@/features/mesero/components/MeseroPageContent";

export default function MeseroPage() {
  return (
    <MeseroNameGate>
      <MeseroPageContent />
    </MeseroNameGate>
  );
}
