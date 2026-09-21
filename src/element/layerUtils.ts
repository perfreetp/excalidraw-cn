import { ExcalidrawElement } from "./types";
import { isTextElement } from "./typeChecks";

/**
 * Returns true if the element matches the layers-panel search query.
 * Text elements match by their text; other elements match by their custom
 * name (customData.name), when present. Matching is case-insensitive and
 * works for Chinese text as well.
 */
export const elementMatchesQuery = (
  element: ExcalidrawElement,
  query: string,
): boolean => {
  const keyword = query.trim().toLowerCase();
  if (!keyword) {
    return false;
  }
  if (isTextElement(element)) {
    return element.text.toLowerCase().includes(keyword);
  }
  const customName = element.customData?.name;
  if (typeof customName === "string" && customName) {
    return customName.toLowerCase().includes(keyword);
  }
  return false;
};

/** Human readable summary shown in the layers panel for a given element. */
export const getElementLayerSummary = (
  element: ExcalidrawElement,
  fallback: string,
): string => {
  if (isTextElement(element)) {
    const text = element.text.replace(/\n/g, " ").trim();
    return text || fallback;
  }
  const customName = element.customData?.name;
  if (typeof customName === "string" && customName.trim()) {
    return customName.trim();
  }
  return fallback;
};
