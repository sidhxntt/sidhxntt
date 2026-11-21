import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ProjectCarousel } from "./ProjectCarousel";

const THREE_IMAGES = [
  "/projects/demo/01.png",
  "/projects/demo/02.png",
  "/projects/demo/03.png",
] as const;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function renderCarousel(
  props: Partial<React.ComponentProps<typeof ProjectCarousel>> = {},
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);

  const render = (next: Partial<React.ComponentProps<typeof ProjectCarousel>> = {}) => {
    act(() => {
      root?.render(
        <ProjectCarousel
          projectId="demo"
          projectName="Demo"
          images={THREE_IMAGES}
          {...props}
          {...next}
        />,
      );
    });
  };

  render();
  return { host, render };
}

function click(element: Element | null) {
  expect(element).not.toBeNull();
  act(() => element?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function press(key: string) {
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })));
}

function swipe(element: Element, from: number, to: number) {
  const pointer = (type: string, clientX: number) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, "clientX", { value: clientX });
    element.dispatchEvent(event);
  };

  act(() => {
    pointer("pointerdown", from);
    pointer("pointerup", to);
  });
}

describe("ProjectCarousel", () => {
  it("renders a single image without carousel controls", () => {
    const { host } = renderCarousel({ images: ["/projects/demo/01.png"] });

    expect(host.querySelector('img[alt="Demo screenshot 1 of 1"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Next screenshot"]')).toBeNull();
    expect(host.textContent).not.toContain("Slide 1 of 1");
  });

  it("navigates forward and backward with wrapping", () => {
    const { host } = renderCarousel();

    expect(host.textContent).toContain("Slide 1 of 3");
    click(host.querySelector('[aria-label="Previous screenshot"]'));
    expect(host.textContent).toContain("Slide 3 of 3");
    click(host.querySelector('[aria-label="Next screenshot"]'));
    expect(host.textContent).toContain("Slide 1 of 3");
  });

  it("selects slides from dots and keyboard arrows", () => {
    const { host } = renderCarousel();

    click(host.querySelector('[aria-label="Show screenshot 2"]'));
    expect(host.textContent).toContain("Slide 2 of 3");
    press("ArrowRight");
    expect(host.textContent).toContain("Slide 3 of 3");
    press("ArrowLeft");
    expect(host.textContent).toContain("Slide 2 of 3");
  });

  it("supports horizontal swipe gestures", () => {
    const { host } = renderCarousel();
    const gallery = host.querySelector('[aria-label="Demo screenshots"]');
    expect(gallery).not.toBeNull();

    swipe(gallery!, 180, 80);
    expect(host.textContent).toContain("Slide 2 of 3");
    swipe(gallery!, 80, 180);
    expect(host.textContent).toContain("Slide 1 of 3");
  });

  it("resets to the first slide when the project changes", () => {
    const { host, render } = renderCarousel();
    click(host.querySelector('[aria-label="Next screenshot"]'));
    expect(host.textContent).toContain("Slide 2 of 3");

    render({ projectId: "other", projectName: "Other" });
    expect(host.textContent).toContain("Slide 1 of 3");
  });
});
