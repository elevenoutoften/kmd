import { describe, expect, it } from "vitest";
import { dedupeRecentFiles, type RecentFile } from "./useRecentFiles";

function recent(path: string, last_opened_at: number): RecentFile {
  return {
    path,
    display_name: path.split(/[\\/]/).pop() ?? path,
    last_opened_at,
  };
}

describe("dedupeRecentFiles", () => {
  it("keeps the newest row when the same path appears more than once", () => {
    const files = [
      recent("/Users/me/Docs/notes.md", 20),
      recent("file:///Users/me/Docs/notes.md", 30),
      recent("/Users/me/Docs/other.md", 10),
    ];

    expect(dedupeRecentFiles(files)).toEqual([files[1], files[2]]);
  });

  it("matches Windows file URLs with plain Windows paths", () => {
    const files = [
      recent("file:///C:/Users/me/Docs/notes.md", 30),
      recent("C:\\Users\\me\\Docs\\notes.md", 20),
    ];

    expect(dedupeRecentFiles(files)).toEqual([files[0]]);
  });
});
