import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = new Map<string, string>();

export async function loadPromptText(relativePathFromProjectRoot: string) {
  const key = relativePathFromProjectRoot;
  const cached = cache.get(key);
  if (cached) return cached;

  const abs = path.join(/*turbopackIgnore: true*/ process.cwd(), relativePathFromProjectRoot);
  const text = await readFile(abs, "utf8");
  cache.set(key, text);
  return text;
}

