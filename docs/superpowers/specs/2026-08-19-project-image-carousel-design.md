# Project Image Carousel Design

## Goal

Give every portfolio project an ordered image gallery. Existing screenshots move into a folder whose name exactly matches the project ID, and project details display that gallery as a carousel.

## Asset convention

- Project images live in `public/projects/<project-id>/`.
- Images use zero-padded names (`01.png`, `02.png`, `03.png`) to make their intended order obvious.
- Every current project begins with its existing screenshot renamed to `01.png`.
- Project data explicitly lists its ordered public image paths. This avoids runtime filesystem scanning and behaves consistently in local development and serverless deployments.

## Data model

Replace the singular `Project.preview` field with `Project.images: string[]`. The first item is the project card thumbnail and the initial project-detail slide. Project records must contain at least one image.

## Interface behavior

- Project cards continue to show one thumbnail, using the first image.
- Project details show the full ordered image list.
- With multiple images, the gallery provides previous and next buttons, position dots, horizontal swipe navigation, and Left/Right Arrow keyboard navigation.
- Navigation wraps at both ends.
- With one image, the image remains static and carousel controls are hidden.
- Images retain the existing contained presentation so screenshots are never cropped.
- Changing projects or reopening a detail resets the active slide to the first image.

## Accessibility

- Previous and next buttons have descriptive accessible labels.
- Position controls identify their target slide and expose the selected slide.
- Keyboard navigation only operates while project details are mounted.
- Motion remains a small slide/fade transition and respects reduced-motion preferences.

## Error handling

Project data is the source of truth. A missing asset falls back to the browser/Next image failure behavior; tests protect against empty image arrays and invalid project-folder mappings.

## Verification

- Add data tests ensuring every project has at least one image, paths start with `/projects/<id>/`, and paths are unique.
- Add interaction tests for single-image controls, next/previous navigation, wrapping, dots, and keyboard navigation.
- Run the focused tests, full test suite, type checking, and production build.
