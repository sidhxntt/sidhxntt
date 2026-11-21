import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { projects } from "./portfolio";

describe("project image galleries", () => {
  it("gives every project at least one ordered image in its matching folder", () => {
    for (const project of projects) {
      const images = (project as typeof project & { images?: string[] }).images;

      expect(images, project.id).toBeDefined();
      expect(images?.length, project.id).toBeGreaterThan(0);
      images?.forEach((image, index) => {
        // featured ("hot") projects keep their screenshots under /projects/hots/
        expect(image).toMatch(new RegExp(`^/projects/(hots/)?${project.id}/\\d{2}\\.[a-z0-9]+$`, "i"));
        expect(Number(image.match(/\/(\d{2})\./)?.[1]), image).toBe(index + 1);
      });
    }
  });

  it("points every image at a file that exists in public/", () => {
    for (const project of projects) {
      for (const image of (project as typeof project & { images?: string[] }).images ?? []) {
        expect(existsSync(path.join(process.cwd(), "public", image)), image).toBe(true);
      }
    }
  });

  it("does not reuse an image path across projects", () => {
    const images = projects.flatMap(
      (project) => (project as typeof project & { images?: string[] }).images ?? [],
    );

    expect(new Set(images).size).toBe(images.length);
  });
});
