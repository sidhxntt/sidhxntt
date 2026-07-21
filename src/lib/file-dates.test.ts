import { describe, expect, it } from "vitest";
import { fileDate, fileDay, fileStamp, PENDING_DATE } from "@/lib/file-dates";

// Fixed reference clock: Mon 20 Jul 2026, 15:30 local time.
const NOW = new Date(2026, 6, 20, 15, 30).getTime();

describe("fileStamp", () => {
  it("renders the placeholder before the client clock arrives", () => {
    expect(fileStamp(null, 3, 10, 0)).toBe(PENDING_DATE);
    expect(PENDING_DATE).toBe("--");
  });

  it("today / yesterday keep relative names", () => {
    expect(fileStamp(NOW, 0, 14, 10)).toBe("Today at 2:10 PM");
    expect(fileStamp(NOW, 1, 16, 44)).toBe("Yesterday at 4:44 PM");
  });

  it("dates in the current year drop the year", () => {
    // 34 days before 20 Jul 2026 → 16 Jun 2026
    expect(fileStamp(NOW, 34, 16, 12)).toBe("16 Jun at 4:12 PM");
  });

  it("dates in an earlier year spell it out", () => {
    // 260 days before 20 Jul 2026 → 2 Nov 2025
    expect(fileStamp(NOW, 260, 3, 14)).toBe("2 Nov 2025 at 3:14 AM");
  });

  it("formats the 12-hour clock edges by hand", () => {
    expect(fileStamp(NOW, 0, 0, 5)).toBe("Today at 12:05 AM"); // midnight
    expect(fileStamp(NOW, 0, 12, 0)).toBe("Today at 12:00 PM"); // noon
    expect(fileStamp(NOW, 0, 23, 59)).toBe("Today at 11:59 PM");
  });
});

describe("fileDay", () => {
  it("renders the placeholder before the client clock arrives", () => {
    expect(fileDay(null, 2)).toBe(PENDING_DATE);
  });

  it("always includes the year, even for the current one", () => {
    expect(fileDay(NOW, 0)).toBe("20 Jul 2026");
    expect(fileDay(NOW, 260)).toBe("2 Nov 2025");
  });
});

describe("fileDate", () => {
  it("returns the underlying Date at the requested wall-clock time", () => {
    const d = fileDate(NOW, 34, 16, 12);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(16);
    expect(d.getMinutes()).toBe(12);
  });

  it("defaults to noon", () => {
    const d = fileDate(NOW, 1);
    expect(d.getHours()).toBe(12);
    expect(d.getMinutes()).toBe(0);
  });
});
