// The newsletter lives in extensions/newsletter; this file only mounts it here.
export { default, generateMetadata } from "@nl/app/entry";

export const revalidate = 60;
