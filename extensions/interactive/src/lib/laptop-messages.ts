// postMessage tags between the laptop page (/interactive) and the OS running
// inside its screen (/interactive/os). Both sides check the origin too.

/** Sent by the laptop page: `{ source: LAPTOP_SOURCE, type: "boot" }` once the lid is open. */
export const LAPTOP_SOURCE = "sidhxntt-laptop";

/** Sent by the OS: `{ source: OS_SOURCE, type: "ready" }` once it can receive "boot". */
export const OS_SOURCE = "sidhxntt-os";
