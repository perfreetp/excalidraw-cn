import { newElementWith } from "../element/mutateElement";
import { ExcalidrawElement, ExcalidrawTextElement } from "../element/types";
import { isTextElement } from "../element/typeChecks";
import { getNonDeletedElements } from "../element";
import { updateTextElement } from "../element/newElement";
import { register } from "./register";

export type LayerProperty = "locked" | "hidden";

export type LayerActionData = {
  /** element ids to operate on; falls back to current selection if omitted */
  elementIds?: string[];
  property?: LayerProperty;
  value?: boolean;
  /** element id to be renamed (text elements) */
  elementId?: string;
  /** new text when renaming a text element */
  text?: string;
  /** element ids to be deleted */
  deleteIds?: string[];
  /** id of the dragged element */
  draggedId?: string;
  /** id of the element onto which the dragged element was dropped */
  targetId?: string;
  /** drop before (false = drop after) the target element */
  dropBefore?: boolean;
};

/**
 * Toggle locked/hidden on a set of elements (or the current selection).
 * When no explicit value is supplied, derives it from the targets (turn the
 * flag on if at least one of them doesn't have it set).
 */
export const actionSetLayerProperty = register({
  name: "setLayerProperty",
  trackEvent: { category: "element" },
  perform: (elements, appState, data: LayerActionData) => {
    if (!data?.property) {
      return false;
    }
    const ids = new Set(
      data.elementIds ??
        Object.keys(appState.selectedElementIds).filter(
          (id) => appState.selectedElementIds[id],
        ),
    );
    if (!ids.size) {
      return false;
    }
    const targetElements = elements.filter(
      (el) => !el.isDeleted && ids.has(el.id),
    );
    if (!targetElements.length) {
      return false;
    }
    const value =
      typeof data.value === "boolean"
        ? data.value
        : targetElements.some((el) => !el[data.property!]);

    const nextElements = elements.map((el) => {
      if (!ids.has(el.id) || el.isDeleted) {
        return el;
      }
      return newElementWith(el, {
        [data.property!]: value,
      } as Partial<ExcalidrawElement>);
    });

    let nextAppState = appState;
    // hiding elements deselects them so they can't be manipulated while hidden
    if (data.property === "hidden" && value) {
      const selectedElementIds = { ...appState.selectedElementIds };
      ids.forEach((id) => delete selectedElementIds[id]);
      nextAppState = { ...appState, selectedElementIds };
    }

    return {
      elements: nextElements,
      appState: nextAppState,
      commitToHistory: true,
    };
  },
});

/** Rename (rewrite the text of) a text element from the layers panel. */
export const actionRenameLayer = register({
  name: "renameLayer",
  trackEvent: { category: "element" },
  perform: (elements, appState, data: LayerActionData) => {
    if (!data?.elementId || typeof data.text !== "string") {
      return false;
    }
    let changed = false;
    const nextElements = elements.map((el) => {
      if (el.id !== data.elementId || !isTextElement(el)) {
        return el;
      }
      const text = data.text!.trim();
      if (text === el.text || text.length === 0) {
        return el;
      }
      changed = true;
      return updateTextElement(el as ExcalidrawTextElement, {
        text,
        originalText: text,
      });
    });
    if (!changed) {
      return false;
    }
    return {
      elements: nextElements,
      appState,
      commitToHistory: true,
    };
  },
});

/** Delete elements by ids from the layers panel. */
export const actionDeleteLayers = register({
  name: "deleteLayers",
  trackEvent: { category: "element" },
  perform: (elements, appState, data: LayerActionData) => {
    const ids = new Set(data?.deleteIds ?? []);
    if (!ids.size) {
      return false;
    }
    let changed = false;
    const nextElements = elements.map((el) => {
      if (el.isDeleted || !ids.has(el.id)) {
        return el;
      }
      changed = true;
      return newElementWith(el, { isDeleted: true });
    });
    if (!changed) {
      return false;
    }
    const selectedElementIds = { ...appState.selectedElementIds };
    ids.forEach((id) => delete selectedElementIds[id]);
    return {
      elements: nextElements,
      appState: { ...appState, selectedElementIds },
      commitToHistory: true,
    };
  },
});

/**
 * Reorder a single element in the z-order via drag & drop in the layers
 * panel. The dragged element's bound text moves together with it, and a
 * container can't be inserted between its own bound text.
 */
export const actionReorderLayer = register({
  name: "reorderLayer",
  trackEvent: { category: "element" },
  perform: (elements, appState, data: LayerActionData) => {
    const draggedId = data?.draggedId;
    const targetId = data?.targetId;
    if (!draggedId || !targetId || draggedId === targetId) {
      return false;
    }
    const nonDeleted = getNonDeletedElements(elements);
    const dragged = nonDeleted.find((el) => el.id === draggedId);
    const target = nonDeleted.find((el) => el.id === targetId);
    if (!dragged || !target) {
      return false;
    }

    // collect dragged unit: container + bound text (or text + its container)
    const movingIds = new Set<string>([draggedId]);
    if ("containerId" in dragged && dragged.containerId) {
      movingIds.add(dragged.containerId);
    }
    dragged.boundElements
      ?.filter((binding) => binding.type === "text")
      .forEach((binding) => movingIds.add(binding.id));
    if ("containerId" in target && target.containerId) {
      movingIds.delete(target.containerId);
    }

    const moving = nonDeleted.filter((el) => movingIds.has(el.id));
    const rest = nonDeleted.filter((el) => !movingIds.has(el.id));
    if (!moving.length) {
      return false;
    }

    // anchor index: if dropping *after* a container, place the moving unit
    // after its bound text to keep them adjacent
    let anchor = target;
    if (!data.dropBefore) {
      const boundTextId = target.boundElements?.find(
        (binding) => binding.type === "text",
      )?.id;
      const boundText = boundTextId
        ? rest.find((el) => el.id === boundTextId)
        : undefined;
      if (boundText) {
        anchor = boundText;
      }
    }
    // if dropping *before* a bound text, anchor on its container instead
    if (data.dropBefore && isTextElement(anchor) && anchor.containerId) {
      const anchorContainerId = anchor.containerId;
      const container = rest.find((el) => el.id === anchorContainerId);
      if (container) {
        anchor = container;
      }
    }

    let insertIndex = rest.findIndex((el) => el.id === anchor.id);
    if (insertIndex === -1) {
      return false;
    }
    if (!data.dropBefore) {
      insertIndex += 1;
    }

    const ordered = [
      ...rest.slice(0, insertIndex),
      ...moving,
      ...rest.slice(insertIndex),
    ];
    const deleted = elements.filter((el) => el.isDeleted);

    return {
      elements: [...ordered, ...deleted],
      appState,
      commitToHistory: true,
    };
  },
});
