"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { getAccentColor, subscribeAccent } from "@/lib/accent";
import { getTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { getBrightness, subscribeBrightness } from "@/lib/ui";
import { Wallpaper } from "./Wallpaper";
import { AppIcon, FolderIcon } from "@/components/AppIcon";
import { linkApps } from "@/data/portfolio";
import { openExternal } from "@/lib/browser";
import { APPS } from "@/components/apps/registry";
import { FileIcon } from "@/components/apps/MyFolder";
import { DESKTOP_ITEMS, type DesktopItem } from "@/data/desktop-items";
import { requestFinderLocation } from "@/lib/finder-nav";
import { Window } from "@/components/window/Window";
import { useWindowManager } from "@/components/window/WindowManager";
import { NotificationBanner } from "@/components/NotificationBanner";
import { DesktopIcon } from "./DesktopIcon";
import { Dock } from "./Dock";
import { Draggable } from "./Draggable";
import { MenuBar } from "./MenuBar";
import { Spotlight } from "./Spotlight";
import { Widgets, type Coords } from "./Widgets";

// My Folder dissolved — its contents live directly on the desktop now.
// Folders open the Finder UI at that location; files open their app.
// The items themselves live in @/data/desktop-items (shared with Spotlight);
// only the icon rendering is local, since that needs React.
function DesktopItemIcon({ item }: { item: DesktopItem }) {
  if (item.badge) return <FileIcon label={item.badge.label} color={item.badge.color} size={48} />;
  return <FolderIcon size={48} />;
}

export function Desktop({
  onRestart,
  onShutDown,
  coords,
  geoDone,
}: {
  onRestart: () => void;
  onShutDown: () => void;
  coords: Coords;
  geoDone: boolean;
}) {
  const { windows, openApp } = useWindowManager();
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [brightness, setBrightnessState] = useState(getBrightness());
  const [theme, setThemeState] = useState<Theme>("light");
  const [accentColor, setAccentColor] = useState("#3b82f6");

  useEffect(() => subscribeBrightness(setBrightnessState), []);
  useEffect(() => {
    setThemeState(getTheme());
    return subscribeTheme(setThemeState);
  }, []);
  useEffect(() => {
    setAccentColor(getAccentColor());
    return subscribeAccent(() => setAccentColor(getAccentColor()));
  }, []);

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden"
      data-theme={theme}
      style={{ filter: `brightness(${brightness})`, "--accent": accentColor } as React.CSSProperties}
      onClick={() => setSelectedIcon(null)}
    >
      <Wallpaper />
      <MenuBar onRestart={onRestart} onShutDown={onShutDown} />
      <Widgets coords={coords} geoDone={geoDone} />

      {/* Desktop icons — right-aligned two-across grid, draggable */}
      <div className="absolute right-3 top-10 grid grid-cols-2 gap-1">
        {DESKTOP_ITEMS.map((item) => (
          <Draggable key={item.key}>
            <DesktopIcon
              label={item.label}
              icon={<DesktopItemIcon item={item} />}
              selected={selectedIcon === item.key}
              onSelect={() => setSelectedIcon(item.key)}
              onOpen={() => {
                if (item.finderLoc) requestFinderLocation(item.finderLoc);
                openApp(item.appId);
              }}
            />
          </Draggable>
        ))}
        {/* Link-only apps — same grid, but they leave for a browser tab */}
        {linkApps.map((app) => (
          <Draggable key={app.id}>
            <DesktopIcon
              label={app.name}
              icon={<AppIcon id={app.id} size={48} />}
              selected={selectedIcon === app.id}
              onSelect={() => setSelectedIcon(app.id)}
              onOpen={() => openExternal(app.url)}
            />
          </Draggable>
        ))}
      </div>

      {/* Windows */}
      <AnimatePresence>
        {APPS.map((app) => {
          const win = windows[app.id];
          if (!win?.open || win.minimized) return null;
          const Content = app.component;
          return (
            <Window key={app.id} win={win} title={app.name}>
              <Content />
            </Window>
          );
        })}
      </AnimatePresence>

      <Spotlight />

      <Dock />

      {/* Slides in from the right just under the menu bar, over everything */}
      <NotificationBanner />
    </div>
  );
}
