# Folio 2025, customised for sidhxntt.dev

This is the **Game OS** of [sidhxntt.dev](https://sidhxntt.dev), served at `/game`.
It is built on Bruno Simon's [Folio 2025](https://github.com/brunosimon/folio-2025)
(MIT, see `license.md`), made into Siddhant Gupta's portfolio.

## What's customised, and where to change it

| In the world | Edit |
|---|---|
| The big name letters on the landing area | `sources/data/name.js` (`NAME`), then `npm run name-font` |
| Monogram on the social pedestal | `sources/data/name.js` (`MONOGRAM`), then `npm run name-font` |
| Projects area (big screens) | `sources/data/projects.js`; images in `static/projects/images` (960×540 .png) |
| Lab area (gallery) | `sources/data/lab.js`; images in `static/lab/images` (960×540 + 240×136 `-mini`) |
| Career timeline | `sources/data/career.js`; labels in `static/career` (.png, see the file's notes) |
| Social links and pad icons | `sources/data/social.js` (exactly 8; `icon` letters need `npm run name-font`) |
| Intro, behind-the-scenes text, page meta | `sources/index.html` |
| Developer-console message | `sources/data/consoleLog.js` |

The 3D lettering (name, monogram, pad icons) is generated in code from
Montserrat ExtraBold (SIL OFL) by `sources/Game/World/Areas/textObjects.js`;
`npm run name-font` regenerates the glyphs it needs into `sources/data/nameFont.js`.

### Removed: everything that needed Bruno's server

The original talked to a live game server. This version has no server at all:

- **Removed completely:** the race circuit (its track props, timer and leaderboard),
  Whispers (visitor messages), the Easter and Black Friday promos, and the
  server status line in Options. Their achievements are gone too.
- **Now local:** the cookie counter and the altar's sacrifice counter count this
  visitor's own score in `localStorage`. Every 10th sacrifice summons the tornado
  for 90 seconds (`sources/Game/World/Areas/AltarArea.js`).
- **Time machine:** labelled "Back to website"; it takes you to `/`.

The main site builds this folder into `public/game` (`scripts/build-game.mjs` in
the repo root) before `next build`.

---

## Original readme (Folio 2025)

## Setup

Create `.env` file based on `.env.example`

Download and install [Node.js](https://nodejs.org/en/download/) then run this followed commands:

``` bash
# Install dependencies
npm install --force

# Serve at localhost:1234
npm run dev

# Build for production in the dist/ directory
npm run build
```

## Game loop

#### 0

- Time
- Inputs

#### 1

- Player:pre-physics (Inputs)

#### 2

- PhysicalVehicle:pre-physics (Player:pre-physics)

#### 3

- Physics

#### 4

- PhysicsWireframe (Physics)
- Objects (Physics)

#### 5

- PhysicalVehicle:post-physics (Player:pre-physics)

#### 6

- Player:post-physics (Physics, PhysicalVehicle:post-physics)

#### 7

- View (Inputs, Player:post-physics)

#### 8

- Intro
- DayCycles
- YearCycles
- Weather (DayCycles, YearCycles)
- Zones (Player:post-physics)
- VisualVehicle (PhysicalVehicle:post-physics, Inputs, Player:post-physics, View)

#### 9

- Wind (Weather)
- Lighting (DayCycles, View)
- Tornado (DayCycles, PhysicalVehicle)
- InteractivePoints (Player:post-physics)
- Tracks (VisualVehicle)

#### 10

- Area++ (View, PhysicalVehicle:post-physics, Player:post-physics, Wind)
- Foliage (VisualVehicle, View)
- Fog (View)
- Reveal (DayCycles)
- Terrain (Tracks)
- Trails (PhysicalVehicle)
- Floor (View)
- Grass (View, Wind)
- Leaves (View, PhysicalVehicle)
- Lightnings (View, Weather)
- RainLines (View, Weather, Reveal)
- Snow (View, Weather, Reveal, Tracks)
- VisualTornado (Tornado)
- WaterSurface (Weather, View)
- Benches (Objects)
- Bricks (Objects)
- ExplosiveCrates (Objects)
- Fences (Objects)
- Lanterns (Objects)

#### 13

- InstancedGroup (Objects, [SpecificObjects])

#### 14

- Audio (View, Objects)
- Notifications
- Title (PhysicalVehicle:post-physics)

#### 998

- Rendering

#### 999

- Monitoring

## Blender

### Export

- Mute the palette texture node (loaded and set in Three.js `Material` directly)
- Use corresponding export presets
- Don't use compression (will be done later)

### Compress

Run `npm run compress`

Will do the following

#### GLB

- Traverses the `static/` folder looking for glb files (ignoring already compressed files)
- Compresses embeded texture with `etc1s --quality 255` (lossy, GPU friendly)
- Generates new files to preserve originals

#### Texture files

- Traverses the `static/` folder looking for `png|jpg` files (ignoring non-model related folders)
- Compresses with default preset to `--encode etc1s --qlevel 255` (lossy, GPU friendly) or specific preset according to path
- Generates new files to preserve originals

#### UI files

- Traverses the `static/ui.` folder looking for `png|jpg` files
- Compresses to WebP

#### Resources

- https://gltf-transform.dev/cli
- https://github.com/KhronosGroup/KTX-Software?tab=readme-ov-file
- https://github.khronos.org/KTX-Software/ktxtools/toktx.html