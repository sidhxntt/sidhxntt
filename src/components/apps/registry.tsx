import type { ComponentType } from "react";
import type { AppId } from "@/components/AppIcon";
import { APP_META, type AppMeta } from "./app-meta";
import { About } from "./About";
import { Projects } from "./Projects";
import { Resume } from "./Resume";
import { Contact } from "./Contact";
import { Pictures } from "./Pictures";
import { Music } from "./Music";
import { MyFolder } from "./MyFolder";
import { CalendarApp } from "./CalendarApp";
import { SettingsApp } from "./SettingsApp";
import { Terminal } from "./Terminal";
import { Messages } from "./Messages";
import { CodeApp } from "./CodeApp";
import { PhotoBooth } from "./PhotoBooth";
import { ActivityMonitor } from "./ActivityMonitor";
import { WeatherApp } from "./WeatherApp";
import { Safari } from "./Safari";
import { SnakeApp, PacManApp, Game2048App, MinesweeperApp, BreakoutApp, DinoApp, VaultApp, QuestApp } from "./game-apps";

export type AppDef = AppMeta & { component: ComponentType };

const COMPONENTS: Record<AppId, ComponentType> = {
  myfolder: MyFolder,
  calendar: CalendarApp,
  about: About,
  projects: Projects,
  resume: Resume,
  contact: Contact,
  pictures: Pictures,
  music: Music,
  settings: SettingsApp,
  terminal: Terminal,
  messages: Messages,
  safari: Safari,
  code: CodeApp,
  photobooth: PhotoBooth,
  activity: ActivityMonitor,
  weather: WeatherApp,
  "game-snake": SnakeApp,
  "game-pacman": PacManApp,
  "game-2048": Game2048App,
  "game-mines": MinesweeperApp,
  "game-breakout": BreakoutApp,
  "game-dino": DinoApp,
  "game-vault": VaultApp,
  "game-quest": QuestApp,
};

// Single registry driving the dock, desktop icons, iOS springboard,
// and window rendering. Add an app = one app-meta.ts entry + one component
// here. Metadata lives in app-meta.ts so leaf components can import it
// without creating an import cycle back into this file.
export const APPS: AppDef[] = APP_META.map((m) => ({ ...m, component: COMPONENTS[m.id] }));

export const APP_BY_ID = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<AppId, AppDef>;
