// The two other ways into this portfolio, as a compact strip under the hero.
// Each doorway is one link with a small drawing of what's behind it; hovering
// or focusing it animates the drawing (the dock lifts, the car drives).

type Door = {
  href: string;
  title: string;
  body: string;
  /** description on phones, when it differs */
  bodyOnPhone?: string;
  action: string;
  /** label on phones, when it differs (below 768px, where /interactive shows an iPhone) */
  actionOnPhone?: string;
  art: React.ReactNode;
};

const DOORS: Door[] = [
  {
    href: "/interactive",
    title: "Interactive OS",
    body: "This portfolio as a MacBook desktop, with apps, a terminal and Siri.",
    bodyOnPhone: "This portfolio as an iPhone home screen, with apps and Siri.",
    action: "Boot the MacBook",
    actionOnPhone: "Boot the iPhone",
    art: <DesktopArt />,
  },
  {
    href: "/game",
    title: "Game OS",
    body: "This portfolio as a 3D world you drive around. Heavier to load.",
    action: "Start the game",
    art: <GameArt />,
  },
];

export function Doorways() {
  return (
    <ul className="doors" aria-label="Other ways to explore this portfolio">
      {DOORS.map((d) => (
        <li key={d.href} className="door-item">
          <a className="door" href={d.href}>
            <div className="door__art" aria-hidden>
              {d.art}
            </div>
            <div className="door__text">
              <strong className="door__title">{d.title}</strong>
              {d.bodyOnPhone ? (
                <>
                  <p className="door__body door__desktop-only">{d.body}</p>
                  <p className="door__body door__phone-only">{d.bodyOnPhone}</p>
                </>
              ) : (
                <p className="door__body">{d.body}</p>
              )}
              <span className="door__action">
                {d.actionOnPhone ? (
                  <>
                    <span className="door__desktop-only">{d.action}</span>
                    <span className="door__phone-only">{d.actionOnPhone}</span>
                  </>
                ) : (
                  d.action
                )}
              </span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ── Interactive OS: a tiny desktop with a menu bar, two windows and a dock ── */

function DesktopArt() {
  const dockIcons = 7;
  const iconSize = 14;
  const gap = 6;
  const dockWidth = dockIcons * iconSize + (dockIcons + 1) * gap;
  const dockX = (320 - dockWidth) / 2;
  return (
    <svg viewBox="0 0 320 190" className="art art--desktop">
      <rect className="art__screen" x="1" y="1" width="318" height="188" rx="10" />
      {/* menu bar */}
      <rect className="art__bar" x="1" y="1" width="318" height="13" rx="10" />
      <rect className="art__bar-fix" x="1" y="8" width="318" height="6" />
      <circle className="art__accent" cx="12" cy="7.5" r="2.4" />
      <rect className="art__ink" x="20" y="6" width="16" height="3" rx="1.5" />
      <rect className="art__ink" x="40" y="6" width="12" height="3" rx="1.5" />
      <rect className="art__ink" x="56" y="6" width="14" height="3" rx="1.5" />
      <rect className="art__ink" x="282" y="6" width="26" height="3" rx="1.5" />
      {/* back window */}
      <g className="art__win art__win--back">
        <rect className="art__window" x="168" y="30" width="128" height="88" rx="6" />
        <rect className="art__ink" x="180" y="52" width="70" height="3" rx="1.5" />
        <rect className="art__ink" x="180" y="60" width="92" height="3" rx="1.5" />
        <rect className="art__ink" x="180" y="68" width="56" height="3" rx="1.5" />
      </g>
      {/* front window: a terminal */}
      <g className="art__win art__win--front">
        <rect className="art__window art__window--front" x="34" y="44" width="164" height="96" rx="6" />
        <circle className="art__light" cx="44" cy="53" r="2.6" />
        <circle className="art__light" cx="52" cy="53" r="2.6" />
        <circle className="art__light" cx="60" cy="53" r="2.6" />
        <rect className="art__accent" x="44" y="70" width="8" height="3" rx="1.5" />
        <rect className="art__ink" x="56" y="70" width="64" height="3" rx="1.5" />
        <rect className="art__ink" x="44" y="80" width="96" height="3" rx="1.5" />
        <rect className="art__ink" x="44" y="90" width="78" height="3" rx="1.5" />
        <rect className="art__accent" x="44" y="100" width="8" height="3" rx="1.5" />
        <rect className="art__caret" x="56" y="98.5" width="5" height="6" rx="1" />
      </g>
      {/* dock */}
      <rect className="art__dock" x={dockX} y="158" width={dockWidth} height={iconSize + gap * 2} rx="7" />
      {Array.from({ length: dockIcons }, (_, i) => (
        <rect
          key={i}
          className={`art__dock-icon${i === 3 ? " art__dock-icon--accent" : ""}`}
          style={{ "--i": Math.abs(i - 3) } as React.CSSProperties}
          x={dockX + gap + i * (iconSize + gap)}
          y={158 + gap}
          width={iconSize}
          height={iconSize}
          rx="4"
        />
      ))}
    </svg>
  );
}

/* ── Game OS: an isometric patch of ground, a road, trees and a small car ── */

const ROAD = "M 30 128 C 90 98, 120 150, 175 118 S 260 70, 300 92";

function GameArt() {
  // isometric grid lines, clipped to the ground diamond
  const lines: React.ReactNode[] = [];
  for (let i = -6; i <= 6; i++) {
    // lines running down-right (slope +½), stepped along the other axis
    const ax = 160 + i * 25;
    const ay = 95 - i * 12.5;
    lines.push(<line key={`a${i}`} x1={ax - 160} y1={ay - 80} x2={ax + 160} y2={ay + 80} />);
    // lines running up-right (slope −½)
    const bx = 160 + i * 25;
    const by = 95 + i * 12.5;
    lines.push(<line key={`b${i}`} x1={bx - 160} y1={by + 80} x2={bx + 160} y2={by - 80} />);
  }
  const trees = [
    [70, 72],
    [92, 64],
    [232, 132],
    [256, 122],
    [214, 58],
    [118, 150],
  ];
  return (
    <svg viewBox="0 0 320 190" className="art art--game">
      <defs>
        <clipPath id="ground-clip">
          <path d="M160 15 L310 95 L160 175 L10 95 Z" />
        </clipPath>
      </defs>
      <path className="art__ground" d="M160 15 L310 95 L160 175 L10 95 Z" />
      <g className="art__grid" clipPath="url(#ground-clip)">
        {lines}
      </g>
      <path className="art__road-edge" d={ROAD} />
      <path className="art__road" d={ROAD} />
      {trees.map(([x, y]) => (
        <g key={`${x}-${y}`} className="art__tree">
          <ellipse className="art__shadow" cx={x + 3} cy={y + 2} rx="7" ry="3" />
          <path className="art__tree-top" d={`M ${x} ${y - 20} L ${x + 7} ${y} L ${x - 7} ${y} Z`} />
        </g>
      ))}
      <g className="art__car" style={{ offsetPath: `path("${ROAD}")` } as React.CSSProperties}>
        <rect className="art__car-body" x="-9" y="-5" width="18" height="10" rx="3" />
        <rect className="art__car-glass" x="1" y="-3.5" width="5" height="7" rx="1.5" />
      </g>
    </svg>
  );
}
