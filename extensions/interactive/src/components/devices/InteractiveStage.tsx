"use client";

import { useIsMobile } from "@os/lib/useIsMobile";
import { Laptop } from "./Laptop";
import { Phone } from "./Phone";
import stageStyles from "./Stage.module.css";

// /interactive: the OS runs inside a device that matches the visitor's — a
// laptop on desktop, an iPhone on phones (where it shows the iOS home screen).
export function InteractiveStage() {
  const isMobile = useIsMobile();
  if (isMobile === null) return <div className={stageStyles.stage} />;
  return isMobile ? <Phone /> : <Laptop />;
}
