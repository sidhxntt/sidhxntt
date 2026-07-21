/**
 * Frosted-glass tokens shared by the floating system surfaces (Control Center
 * islands, Siri). Kept in lib so panels don't have to import from MenuBar.
 *
 * Note: backdrop-filter only blurs the desktop if no ancestor carries its own
 * backdrop-filter — an ancestor that does becomes the backdrop root.
 */
export const GLASS_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(44,44,50,0.5)",
  backdropFilter: "blur(36px) saturate(180%)",
  WebkitBackdropFilter: "blur(36px) saturate(180%)",
};

export const GLASS_CLASS = "border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)]";
