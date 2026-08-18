# HOT Projects and Rudder Design

## Goal

Add Rudder to the portfolio, keep Media Automations visible as a normal project, and visually distinguish projects classified as HOT with red fire-marked Finder folders.

## Project data

- Add an optional `hot: boolean` property to `Project`; omitted means false.
- HOT classification is explicit data rather than inferred from an asset path.
- Rudder is HOT and uses all six ordered images under `/projects/hots/rudder/`.
- Praxis is HOT and uses `/projects/hots/praxis/01.png`.
- Media Automations remains non-HOT and continues using `/projects/media-automations/01.png`.
- Mirror these records and fields in `input/04-projects.json`.

## Rudder content

Rudder is described from its own repository documentation as a self-hosted, single-operator deployment control plane. Its project copy may name GitHub/Compose import, a Railway-style service canvas, immutable health-gated releases, environments and preview deployments, logs, metrics, rollback, Docker/Kind runtimes, and its controlled GKE reference. It must not claim hosted multi-tenancy, general availability, implemented AWS/Azure adapters, customer adoption, or invented performance results.

Rudder links only to its public GitHub repository because no verified public product deployment URL is supplied.

## Finder presentation

- Extend the shared `FolderIcon` with a `hot` variant.
- Normal folders retain the existing blue macOS treatment.
- HOT project folders use a red tab and body with a centered fire mark.
- The fire mark is part of the folder SVG so it scales consistently in Finder grid and list views.
- Only project items whose data has `hot: true` use the HOT variant; parent folders and non-HOT project folders remain blue.

## Projects application

- Rudder appears as a normal project card and detail view, with its six supplied screenshots using the existing carousel.
- Praxis continues to render using its new HOTS asset path.
- Media Automations remains present as a normal project.
- HOT classification does not add decorative badges to screenshot cards; the requested visual marker belongs to Finder folder representation.

## Verification

- Data tests verify Rudder exists, is HOT, has six ordered HOTS images, and uses the verified repository URL.
- Data tests verify Praxis is HOT and Media Automations is not.
- Folder icon tests verify the HOT variant renders red folder surfaces and a fire mark, while the default remains blue without fire.
- Existing carousel, full test suite, type checking, production build, asset-path checks, and a rendered Finder/Projects flow validate the completed change.
