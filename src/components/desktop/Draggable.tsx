"use client";

import { motion } from "framer-motion";
import { useRef } from "react";

// Makes any desktop item (widget, icon) freely draggable, macOS-style.
// Suppresses the click that lands right after a drag so dragging a widget
// doesn't also trigger its open action.

export function Draggable({ children, className }: { children: React.ReactNode; className?: string }) {
  const lastDragEnd = useRef(0);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      whileDrag={{ scale: 1.03, zIndex: 50 }}
      onDragEnd={() => {
        lastDragEnd.current = Date.now();
      }}
      onClickCapture={(e) => {
        if (Date.now() - lastDragEnd.current < 180) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
