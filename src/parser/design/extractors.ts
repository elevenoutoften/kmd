import type { StageFn } from "./pipeline";
import { extractYaml } from "./extract/yaml";
import { extractTables } from "./extract/tables";
import { extractProse } from "./extract/prose";
import { extractCss } from "./extract/css";
import { extractComponents } from "./extract/components";
import { extractShadow } from "./extract/shadow";
import { extractGradient } from "./extract/gradient";
import { extractSurface } from "./extract/surface";
import { extractLayout } from "./extract/layout";

export const EXTRACTORS: StageFn[] = [
  extractYaml,
  extractTables,
  extractProse,
  extractCss,
  extractComponents,
  extractShadow,
  extractGradient,
  extractSurface,
  extractLayout,
];
