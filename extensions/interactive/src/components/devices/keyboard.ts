// Laptop keyboard layout (US). Widths are in key units: a letter key is 1.
// `sub` is a second, smaller legend (e.g. "⌘" over "command"); `align` puts
// modifier legends in the bottom corner, as on real keycaps.

export type Key = {
  label?: string;
  sub?: string;
  w?: number;
  align?: "left" | "right";
  /** the Touch ID-style power key at the end of the function row */
  power?: boolean;
  /** the arrow cluster: up/down share one key slot, stacked */
  arrows?: true;
};

type KeyRow = { short?: boolean; keys: Key[] };

const fn = (n: number): Key => ({ label: `F${n}` });

export const KEY_ROWS: KeyRow[] = [
  {
    short: true,
    keys: [
      { label: "esc", w: 1.5, align: "left" },
      ...Array.from({ length: 12 }, (_, i) => fn(i + 1)),
      { power: true },
    ],
  },
  {
    keys: [
      { label: "~", sub: "`" },
      { label: "!", sub: "1" },
      { label: "@", sub: "2" },
      { label: "#", sub: "3" },
      { label: "$", sub: "4" },
      { label: "%", sub: "5" },
      { label: "^", sub: "6" },
      { label: "&", sub: "7" },
      { label: "*", sub: "8" },
      { label: "(", sub: "9" },
      { label: ")", sub: "0" },
      { label: "_", sub: "-" },
      { label: "+", sub: "=" },
      { label: "delete", w: 1.5, align: "right" },
    ],
  },
  {
    keys: [
      { label: "tab", w: 1.5, align: "left" },
      ..."QWERTYUIOP".split("").map((c) => ({ label: c })),
      { label: "{", sub: "[" },
      { label: "}", sub: "]" },
      { label: "|", sub: "\\" },
    ],
  },
  {
    keys: [
      { label: "caps lock", w: 1.8, align: "left" },
      ..."ASDFGHJKL".split("").map((c) => ({ label: c })),
      { label: ":", sub: ";" },
      { label: '"', sub: "'" },
      { label: "return", w: 1.7, align: "right" },
    ],
  },
  {
    keys: [
      { label: "shift", w: 2.3, align: "left" },
      ..."ZXCVBNM".split("").map((c) => ({ label: c })),
      { label: "<", sub: "," },
      { label: ">", sub: "." },
      { label: "?", sub: "/" },
      { label: "shift", w: 2.2, align: "right" },
    ],
  },
  {
    keys: [
      { label: "fn", align: "left" },
      { label: "control", sub: "⌃", align: "left" },
      { label: "option", sub: "⌥", align: "left" },
      { label: "command", sub: "⌘", w: 1.3, align: "left" },
      { w: 5.2 },
      { label: "command", sub: "⌘", w: 1.3, align: "left" },
      { label: "option", sub: "⌥", align: "left" },
      { label: "◀" },
      { arrows: true },
      { label: "▶" },
    ],
  },
];
