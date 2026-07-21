// Vitest setup — runs before every test file.
//
// Node 26 ships an experimental `localStorage` global (gated behind
// --localstorage-file) whose presence stops Vitest's jsdom environment from
// exposing jsdom's own Storage. The stores under test (persist.ts and friends)
// need a working window.localStorage, so install a spec-shaped in-memory one.

class MemoryStorage {
  #store = new Map<string, string>();

  get length(): number {
    return this.#store.size;
  }
  clear(): void {
    this.#store.clear();
  }
  getItem(key: string): string | null {
    return this.#store.get(String(key)) ?? null;
  }
  key(index: number): string | null {
    return [...this.#store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#store.delete(String(key));
  }
  setItem(key: string, value: string): void {
    this.#store.set(String(key), String(value));
  }
}

const storage = new MemoryStorage();

for (const target of [globalThis, window] as object[]) {
  try {
    Object.defineProperty(target, "localStorage", {
      value: storage,
      configurable: true,
      writable: true,
    });
  } catch {
    (target as { localStorage?: unknown }).localStorage = storage;
  }
}

// Expose the class as `Storage` so tests can spy on Storage.prototype methods.
Object.defineProperty(globalThis, "Storage", {
  value: MemoryStorage,
  configurable: true,
  writable: true,
});
