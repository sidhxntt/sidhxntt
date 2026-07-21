"use client";

// Power actions travel as a window event so any surface can trigger them
// without threading callbacks down — MacExperience owns the boot stage and
// listens for these. Terminal already dispatches the same event.

type PowerOp = "restart" | "shutdown" | "lock";

function dispatch(op: PowerOp) {
  window.dispatchEvent(new CustomEvent("portfolio-power", { detail: op }));
}

/** Back to the lock screen. Windows stay open behind it. */
export function lockScreen() {
  dispatch("lock");
}

/** Black screen, then boots again with the startup chime. */
export function restart() {
  dispatch("restart");
}

/** All the way off — back to the power button. */
export function shutDown() {
  dispatch("shutdown");
}
