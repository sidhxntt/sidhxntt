// Light/dark theme for the landing site. The choice is stored per visitor;
// with no stored choice the site starts in light mode.

export type SiteTheme = "light" | "dark";

const THEME_STORAGE_KEY = "site-theme";

/** Sets the visitor's theme on <html> as `attribute`, before first paint. */
const themeScript = (attribute: string) =>
  `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t="light"}document.documentElement.setAttribute("${attribute}",t)}catch(e){}})();`;

/** Runs in <head> before first paint so the page never flashes the wrong theme. */
export const THEME_SCRIPT = themeScript("data-theme");

/**
 * The same choice for the Interactive OS pages (the laptop on /interactive).
 * A separate attribute, because the OS's own dark mode is keyed on data-theme.
 */
export const SITE_THEME_SCRIPT = themeScript("data-site-theme");

export function readTheme(): SiteTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: SiteTheme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage blocked — the choice still applies for this visit */
  }
}
