import { GroupId, NonDeletedExcalidrawElement } from "../../element/types";
import { isBoundToContainer } from "../../element/typeChecks";

export type LayerNodeType = "element" | "group";

export interface LayerElementNode {
  type: "element";
  element: NonDeletedExcalidrawElement;
}

export interface LayerGroupNode {
  type: "group";
  groupId: GroupId;
  depth: number;
  children: LayerNode[];
}

export type LayerNode = LayerElementNode | LayerGroupNode;

/**
 * Build a hierarchical layer tree from a flat element list (z-order, bottom
 * first). Elements without groups become top-level nodes; each groupId with
 * >= 2 members becomes a collapsible group node (nested groups supported).
 * Container-bound text is attached to its container.
 */
export const buildLayerTree = (
  elements: readonly NonDeletedExcalidrawElement[],
): LayerNode[] => {
  // groupIds are ordered deepest -> shallowest on every element
  const parentGroup = new Map<GroupId, GroupId | null>();
  const groupMemberCount = new Map<GroupId, number>();
  for (const element of elements) {
    const ids = element.groupIds;
    for (let i = 0; i < ids.length; i++) {
      groupMemberCount.set(ids[i], (groupMemberCount.get(ids[i]) || 0) + 1);
      if (!parentGroup.has(ids[i])) {
        parentGroup.set(ids[i], i + 1 < ids.length ? ids[i + 1] : null);
      }
    }
  }

  // groups with < 2 live members are treated as no groups
  const validGroups = new Set(
    [...parentGroup.keys()].filter(
      (id) => (groupMemberCount.get(id) || 0) >= 2,
    ),
  );

  // element node registry
  const elementNode = new Map<string, LayerElementNode>();
  // pending children buckets per group (key) or root (null)
  const bucket = new Map<GroupId | null, LayerNode[]>();
  bucket.set(null, []);
  for (const id of validGroups) {
    bucket.set(id, []);
  }

  const createdGroups = new Set<GroupId>();
  const nodeById: Record<string, LayerGroupNode> = {};

  const ensureGroupNode = (groupId: GroupId): LayerGroupNode => {
    if (createdGroups.has(groupId)) {
      return nodeById[groupId];
    }
    const rawParent = parentGroup.get(groupId) || null;
    const parentId = rawParent && validGroups.has(rawParent) ? rawParent : null;
    const depth = parentId ? ensureGroupNode(parentId).depth + 1 : 0;
    const node: LayerGroupNode = {
      type: "group",
      groupId,
      depth,
      children: bucket.get(groupId)!,
    };
    nodeById[groupId] = node;
    createdGroups.add(groupId);
    // group node itself is a child in its parent bucket; remove previous
    // registration (happens only when depth is resolved later)
    const siblings = bucket.get(parentId)!;
    if (!siblings.includes(node)) {
      siblings.push(node);
    }
    return node;
  };

  for (const element of elements) {
    if (isBoundToContainer(element)) {
      continue;
    }
    const node: LayerElementNode = { type: "element", element };
    elementNode.set(element.id, node);

    // deepest valid group this element belongs to
    let ownerGroup: GroupId | null = null;
    for (const groupId of element.groupIds) {
      if (validGroups.has(groupId)) {
        ownerGroup = groupId;
        break;
      }
    }

    // lazily create ancestor group nodes (shallowest first) so nesting is
    // ready before members get appended
    if (ownerGroup) {
      const chain: GroupId[] = [];
      let current: GroupId | null = ownerGroup;
      while (current) {
        chain.push(current);
        const raw: GroupId | null = parentGroup.get(current) || null;
        current = raw && validGroups.has(raw) ? raw : null;
      }
      chain.reverse().forEach(ensureGroupNode);
      bucket.get(ownerGroup)!.push(node);
    } else {
      bucket.get(null)!.push(node);
    }
  }

  // attach bound text nodes right after their container node
  const attachBoundText = (nodes: LayerNode[]): LayerNode[] => {
    const result: LayerNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.type === "group") {
        node.children = attachBoundText(node.children);
        continue;
      }
      const containerId = node.element.id;
      for (const element of elements) {
        if (
          isBoundToContainer(element) &&
          element.containerId === containerId
        ) {
          result.push({ type: "element", element });
        }
      }
    }
    return result;
  };

  return attachBoundText(bucket.get(null)!);
};

/** Collect all element ids contained in a node (including group children). */
export const getNodeElementIds = (node: LayerNode): string[] => {
  if (node.type === "element") {
    return [node.element.id];
  }
  return node.children.flatMap(getNodeElementIds);
};

/** Find a group node by id anywhere in the tree (including nested groups). */
export const findGroupNode = (
  nodes: LayerNode[],
  groupId: GroupId,
): LayerGroupNode | null => {
  for (const node of nodes) {
    if (node.type === "group") {
      if (node.groupId === groupId) {
        return node;
      }
      const found = findGroupNode(node.children, groupId);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

/**
 * Filter a layer tree for search: keep element nodes whose id is in
 * `keepIds`, plus group nodes that contain at least one match (with their
 * non-matching descendants pruned). Returns a flat list of element nodes
 * (groups are expanded during search).
 */
export const filterTreeByElementIds = (
  nodes: LayerNode[],
  keepIds: Set<string>,
): LayerNode[] => {
  const result: LayerNode[] = [];
  for (const node of nodes) {
    if (node.type === "element") {
      if (keepIds.has(node.element.id)) {
        result.push(node);
      }
    } else {
      result.push(...filterTreeByElementIds(node.children, keepIds));
    }
  }
  return result;
};
