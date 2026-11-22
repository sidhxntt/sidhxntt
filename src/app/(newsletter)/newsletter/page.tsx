// The newsletter lives in extensions/newsletter; this file only mounts it here.
export { default } from "@nl/app/home";

// cached, and refreshed at most once a minute
export const revalidate = 60;
