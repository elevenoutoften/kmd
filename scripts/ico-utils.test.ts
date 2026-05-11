import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseIcoDirectory } from "./ico-utils.mjs";

describe("Windows app icon", () => {
  it("keeps the highest-resolution ICO frame first for Tauri's runtime window icon", () => {
    const buffer = readFileSync(new URL("../src-tauri/icons/icon.ico", import.meta.url));
    const entries = parseIcoDirectory(buffer);

    expect(entries[0]).toMatchObject({
      width: 256,
      height: 256,
    });

    const orderedSizes = entries.map((entry) => entry.width * entry.height);
    expect(orderedSizes).toEqual([...orderedSizes].sort((left, right) => right - left));
  });
});
