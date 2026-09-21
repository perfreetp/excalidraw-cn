import clsx from "clsx";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActionManager } from "../../actions/manager";
import {
  actionAlignBottom,
  actionAlignHorizontallyCentered,
  actionAlignLeft,
  actionAlignRight,
  actionAlignTop,
  actionAlignVerticallyCentered,
  actionDeleteLayers,
  actionGroup,
  actionRenameLayer,
  actionReorderLayer,
  actionSetLayerProperty,
  actionUngroup,
  distributeHorizontally,
  distributeVertically,
} from "../../actions";
import { Action } from "../../actions/types";
import { getNonDeletedElements, isTextElement } from "../../element";
import { NonDeletedExcalidrawElement } from "../../element/types";
import {
  elementMatchesQuery,
  getElementLayerSummary,
} from "../../element/layerUtils";
import { getCommonBounds } from "../../element";
import { centerScrollOn } from "../../scene";
import { selectGroupsForSelectedElements } from "../../groups";
import { t } from "../../i18n";
import { AppState } from "../../types";
import {
  getLayersMetaFromStorage,
  setLayersMetaToStorage,
} from "../../excalidraw-app/data/localStorage";
import {
  AlignBottomIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  ArrowIcon,
  CenterHorizontallyIcon,
  CenterVerticallyIcon,
  DiamondIcon,
  DistributeHorizontallyIcon,
  DistributeVerticallyIcon,
  EllipseIcon,
  FreedrawIcon,
  GroupIcon,
  ImageIcon,
  LineIcon,
  LockedIcon,
  RectangleIcon,
  TextIcon,
  TrashIcon,
  UngroupIcon,
  UnlockedIcon,
} from "../icons";
import { ToolButton } from "../ToolButton";
import {
  buildLayerTree,
  findGroupNode,
  filterTreeByElementIds,
  getNodeElementIds,
  LayerNode,
} from "./tree";

import "./LayersPanel.scss";

interface LayersPanelProps {
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  actionManager: ActionManager;
  canvas: HTMLCanvasElement | null;
}

const typeIcon = (element: NonDeletedExcalidrawElement): React.ReactNode => {
  switch (element.type) {
    case "rectangle":
      return RectangleIcon;
    case "diamond":
      return DiamondIcon;
    case "ellipse":
      return EllipseIcon;
    case "arrow":
      return ArrowIcon;
    case "line":
      return LineIcon;
    case "freedraw":
      return FreedrawIcon;
    case "text":
      return TextIcon;
    case "image":
      return ImageIcon;
    default:
      return RectangleIcon;
  }
};

const typeLabelKey = (element: NonDeletedExcalidrawElement): string => {
  switch (element.type) {
    case "rectangle":
      return "layersPanel.typeRectangle";
    case "diamond":
      return "layersPanel.typeDiamond";
    case "ellipse":
      return "layersPanel.typeEllipse";
    case "arrow":
      return "layersPanel.typeArrow";
    case "line":
      return "layersPanel.typeLine";
    case "freedraw":
      return "layersPanel.typeFreedraw";
    case "text":
      return "layersPanel.typeText";
    case "image":
      return "layersPanel.typeImage";
    default:
      return "layersPanel.typeRectangle";
  }
};

const EyeIcon = ({ hidden }: { hidden?: boolean }) => (
  <svg
    aria-hidden="true"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    {hidden ? (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.58 10.59a2 2 0 0 0 2.83 2.83" />
        <path d="M9.88 5.09A9.7 9.7 0 0 1 12 5c5 0 9 4.27 10 7-.5 1.36-1.7 3.15-3.45 4.43M6.1 6.1C4.17 7.3 2.96 9.06 2 12c1 2.73 5 7 10 7 1.1 0 2.15-.2 3.1-.56" />
      </>
    ) : (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const ChevronIcon = ({ collapsed }: { collapsed?: boolean }) => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={clsx("layers-panel__chevron", {
      "layers-panel__chevron--collapsed": collapsed,
    })}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const alignButtons: { action: Action; title: string; icon: React.ReactNode }[] =
  [
    {
      action: actionAlignLeft,
      title: "layersPanel.alignLeft",
      icon: AlignLeftIcon,
    },
    {
      action: actionAlignHorizontallyCentered,
      title: "layersPanel.alignHorizontallyCentered",
      icon: CenterHorizontallyIcon,
    },
    {
      action: actionAlignRight,
      title: "layersPanel.alignRight",
      icon: AlignRightIcon,
    },
    {
      action: actionAlignTop,
      title: "layersPanel.alignTop",
      icon: AlignTopIcon,
    },
    {
      action: actionAlignVerticallyCentered,
      title: "layersPanel.alignVerticallyCentered",
      icon: CenterVerticallyIcon,
    },
    {
      action: actionAlignBottom,
      title: "layersPanel.alignBottom",
      icon: AlignBottomIcon,
    },
    {
      action: distributeHorizontally,
      title: "layersPanel.distributeHorizontally",
      icon: DistributeHorizontallyIcon,
    },
    {
      action: distributeVertically,
      title: "layersPanel.distributeVertically",
      icon: DistributeVerticallyIcon,
    },
  ];

export const LayersPanel: React.FC<LayersPanelProps> = ({
  appState,
  setAppState,
  elements,
  actionManager,
  canvas,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragOverBefore, setDragOverBefore] = useState(true);
  const dragCounter = useRef(0);

  // collapsed groups are stored per-canvas (localStorage), not in the global
  // appState which is shared across canvases
  const [collapsedGroups, setCollapsedGroups] = useState<{
    [groupId: string]: boolean;
  }>(() => getLayersMetaFromStorage().collapsedGroups || {});

  useEffect(() => {
    setCollapsedGroups(getLayersMetaFromStorage().collapsedGroups || {});
  }, []);

  const persistCollapsedGroups = (next: { [groupId: string]: boolean }) => {
    setCollapsedGroups(next);
    setLayersMetaToStorage({
      ...getLayersMetaFromStorage(),
      collapsedGroups: next,
    });
  };

  const nonDeleted = useMemo(() => getNonDeletedElements(elements), [elements]);
  const query = appState.layerSearchQuery;

  const tree = useMemo(() => buildLayerTree(nonDeleted), [nonDeleted]);

  const matchSet = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return null;
    }
    return new Set(
      nonDeleted
        .filter((element) => elementMatchesQuery(element, keyword))
        .map((element) => element.id),
    );
  }, [nonDeleted, query]);

  // during search we render a flat filtered list; otherwise the tree renders
  // recursively so collapsed groups hide their descendants
  const searchNodes = useMemo(
    () => (matchSet ? filterTreeByElementIds(tree, matchSet) : null),
    [tree, matchSet],
  );

  const selectedIds = useMemo(
    () =>
      new Set(
        Object.keys(appState.selectedElementIds).filter(
          (id) => appState.selectedElementIds[id],
        ),
      ),
    [appState.selectedElementIds],
  );

  const elementById = useMemo(
    () => new Map(nonDeleted.map((element) => [element.id, element])),
    [nonDeleted],
  );

  const run = (action: Action, data?: any) => {
    if (data === undefined) {
      actionManager.executeAction(action);
    } else {
      actionManager.executeActionWithData(action, data);
    }
  };

  const setSelection = (ids: string[], additive: boolean) => {
    const next = additive ? { ...appState.selectedElementIds } : {};
    if (additive) {
      const allAlreadySelected = ids.every((id) => next[id]);
      ids.forEach((id) => {
        if (allAlreadySelected) {
          delete next[id];
        } else {
          next[id] = true;
        }
      });
    } else {
      ids.forEach((id) => {
        next[id] = true;
      });
    }
    setAppState(
      selectGroupsForSelectedElements(
        {
          ...appState,
          selectedElementIds: next,
          selectedGroupIds: {},
          editingGroupId: null,
        },
        nonDeleted,
      ),
    );
  };

  const panToElements = (targets: NonDeletedExcalidrawElement[]) => {
    if (!targets.length) {
      return;
    }
    const bounds = getCommonBounds(targets);
    const center = {
      x: (bounds[0] + bounds[2]) / 2,
      y: (bounds[1] + bounds[3]) / 2,
    };
    setAppState(
      centerScrollOn({
        scenePoint: center,
        viewportDimensions: { width: appState.width, height: appState.height },
        zoom: appState.zoom,
      }),
    );
    void canvas;
  };

  const handleElementClick = (
    event: React.MouseEvent,
    element: NonDeletedExcalidrawElement,
  ) => {
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    setSelection([element.id], additive);
    if (!additive) {
      panToElements([element]);
    }
  };

  const handleGroupClick = (
    event: React.MouseEvent,
    node: Extract<LayerNode, { type: "group" }>,
  ) => {
    const ids = getNodeElementIds(node).filter(
      (id) => elementById.get(id) && !elementById.get(id)!.hidden,
    );
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    setSelection(ids, additive);
    const targets = ids.map((id) => elementById.get(id)!).filter(Boolean);
    if (!additive && targets.length) {
      panToElements(targets);
    }
  };

  const toggleCollapsed = (groupId: string) => {
    persistCollapsedGroups({
      ...collapsedGroups,
      [groupId]: !collapsedGroups[groupId],
    });
  };

  const startRename = (element: NonDeletedExcalidrawElement) => {
    if (!isTextElement(element)) {
      return;
    }
    setRenamingId(element.id);
    setRenameValue(element.text);
  };

  const commitRename = () => {
    if (renamingId) {
      run(actionRenameLayer, {
        elementId: renamingId,
        text: renameValue,
      });
    }
    setRenamingId(null);
  };

  const removeElements = (ids: string[]) => {
    run(actionDeleteLayers, { deleteIds: ids });
    setRenamingId(null);
  };

  // ---- drag & drop reordering --------------------------------------------
  const onDragStart = (event: React.DragEvent, id: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/excalidraw-layer", id);
  };

  const getDropPosition = (event: React.DragEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    return offset < rect.height / 2;
  };

  const onRowDragEnter = (event: React.DragEvent, id: string) => {
    event.preventDefault();
    dragCounter.current += 1;
    const before = getDropPosition(event, event.currentTarget as HTMLElement);
    setDragOverKey(id);
    setDragOverBefore(before);
  };

  const onRowDragOver = (event: React.DragEvent, id: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const before = getDropPosition(event, event.currentTarget as HTMLElement);
    setDragOverKey(id);
    setDragOverBefore(before);
  };

  const onRowDragLeave = () => {
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOverKey(null);
    }
  };

  const onRowDrop = (event: React.DragEvent, targetId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = event.dataTransfer.getData("text/excalidraw-layer");
    dragCounter.current = 0;
    setDragOverKey(null);
    if (!draggedId || draggedId === targetId) {
      return;
    }
    const before = getDropPosition(event, event.currentTarget as HTMLElement);
    // when dropping on a group header, reposition relative to the group's
    // first (before) / last (after) member
    let resolvedTargetId = targetId;
    if (!elementById.has(targetId)) {
      const groupNode = findGroupNode(tree, targetId);
      const memberIds = groupNode
        ? getNodeElementIds(groupNode).filter((id) => elementById.has(id))
        : [];
      resolvedTargetId = before
        ? memberIds[0]
        : memberIds[memberIds.length - 1];
      if (!resolvedTargetId || resolvedTargetId === draggedId) {
        return;
      }
    }
    run(actionReorderLayer, {
      draggedId,
      targetId: resolvedTargetId,
      dropBefore: before,
    });
  };

  const onContainerDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const onContainerDrop = (event: React.DragEvent) => {
    // dropping in empty area -> move to the end (front) of the layer stack
    const draggedId = event.dataTransfer.getData("text/excalidraw-layer");
    if (!draggedId) {
      return;
    }
    event.preventDefault();
    const last = nonDeleted[nonDeleted.length - 1];
    if (!last || last.id === draggedId) {
      return;
    }
    run(actionReorderLayer, {
      draggedId,
      targetId: last.id,
      dropBefore: false,
    });
  };

  // ---- bulk toolbar -------------------------------------------------------
  const selectedElements = nonDeleted.filter((element) =>
    selectedIds.has(element.id),
  );
  const selectedCount = selectedElements.length;

  // is a complete group selected (for enabling ungroup)
  const selectedGroupIds = Object.keys(appState.selectedGroupIds).filter(
    (id) => appState.selectedGroupIds[id],
  );

  const renderElementRow = (
    element: NonDeletedExcalidrawElement,
    depth: number,
  ) => {
    const isSelected = selectedIds.has(element.id);
    const isRenaming = renamingId === element.id;
    const dimmed = !!matchSet && !matchSet.has(element.id);
    const isDropTarget = dragOverKey === element.id;
    const summary = getElementLayerSummary(element, t(typeLabelKey(element)));

    return (
      <div
        key={element.id}
        className={clsx("layers-panel__row", {
          "layers-panel__row--selected": isSelected,
          "layers-panel__row--dimmed": dimmed,
          "layers-panel__row--hidden": element.hidden,
          "layers-panel__row--drop-before": isDropTarget && dragOverBefore,
          "layers-panel__row--drop-after": isDropTarget && !dragOverBefore,
        })}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable={!isRenaming}
        onDragStart={(event) => onDragStart(event, element.id)}
        onDragEnter={(event) => onRowDragEnter(event, element.id)}
        onDragOver={(event) => onRowDragOver(event, element.id)}
        onDragLeave={onRowDragLeave}
        onDrop={(event) => onRowDrop(event, element.id)}
        onClick={(event) => handleElementClick(event, element)}
        title={summary}
      >
        <span className="layers-panel__type-icon">{typeIcon(element)}</span>
        {isRenaming && isTextElement(element) ? (
          <input
            className="layers-panel__rename-input"
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitRename();
              } else if (event.key === "Escape") {
                setRenamingId(null);
              }
              event.stopPropagation();
            }}
          />
        ) : (
          <span className="layers-panel__label">{summary}</span>
        )}
        <span className="layers-panel__row-actions">
          {isTextElement(element) && (
            <button
              type="button"
              className="layers-panel__icon-btn"
              title={t("layersPanel.rename")}
              onClick={(event) => {
                event.stopPropagation();
                startRename(element);
              }}
            >
              ✎
            </button>
          )}
          <button
            type="button"
            className={clsx("layers-panel__icon-btn", {
              "layers-panel__icon-btn--active": element.locked,
            })}
            title={
              element.locked ? t("layersPanel.unlock") : t("layersPanel.lock")
            }
            onClick={(event) => {
              event.stopPropagation();
              run(actionSetLayerProperty, {
                elementIds: [element.id],
                property: "locked",
              });
            }}
          >
            {element.locked ? LockedIcon : UnlockedIcon}
          </button>
          <button
            type="button"
            className={clsx("layers-panel__icon-btn", {
              "layers-panel__icon-btn--active": element.hidden,
            })}
            title={
              element.hidden ? t("layersPanel.show") : t("layersPanel.hide")
            }
            onClick={(event) => {
              event.stopPropagation();
              run(actionSetLayerProperty, {
                elementIds: [element.id],
                property: "hidden",
              });
            }}
          >
            <EyeIcon hidden={element.hidden} />
          </button>
          <button
            type="button"
            className="layers-panel__icon-btn layers-panel__icon-btn--danger"
            title={t("layersPanel.delete")}
            onClick={(event) => {
              event.stopPropagation();
              removeElements([element.id]);
            }}
          >
            {TrashIcon}
          </button>
        </span>
      </div>
    );
  };

  const renderGroupNode = (
    node: Extract<LayerNode, { type: "group" }>,
  ): React.ReactNode => {
    const collapsed =
      // groups are always expanded visually while searching
      !matchSet && !!collapsedGroups[node.groupId];
    const ids = getNodeElementIds(node);
    const allLocked =
      ids.length > 0 && ids.every((id) => elementById.get(id)?.locked);
    const allHidden =
      ids.length > 0 && ids.every((id) => elementById.get(id)?.hidden);
    const isDropTarget = dragOverKey === node.groupId;
    const selectedInGroupCount = ids.filter((id) => selectedIds.has(id)).length;
    const isSelected = selectedInGroupCount === ids.length && ids.length > 0;

    return (
      <div key={`group-${node.groupId}`}>
        <div
          className={clsx("layers-panel__row layers-panel__row--group", {
            "layers-panel__row--selected": isSelected,
            "layers-panel__row--drop-before": isDropTarget && dragOverBefore,
            "layers-panel__row--drop-after": isDropTarget && !dragOverBefore,
          })}
          style={{ paddingLeft: 8 + node.depth * 14 }}
          onDragEnter={(event) => onRowDragEnter(event, node.groupId)}
          onDragOver={(event) => onRowDragOver(event, node.groupId)}
          onDragLeave={onRowDragLeave}
          onDrop={(event) => onRowDrop(event, node.groupId)}
          onClick={(event) => handleGroupClick(event, node)}
          title={t("layersPanel.group")}
        >
          <button
            type="button"
            className="layers-panel__chevron-btn"
            onClick={(event) => {
              event.stopPropagation();
              toggleCollapsed(node.groupId);
            }}
            title={
              collapsed
                ? t("layersPanel.expandGroup")
                : t("layersPanel.collapseGroup")
            }
          >
            <ChevronIcon collapsed={collapsed} />
          </button>
          <span className="layers-panel__type-icon">
            <GroupIcon theme={appState.theme} />
          </span>
          <span className="layers-panel__label">
            {t("layersPanel.group")}（{ids.length}）
          </span>
          <span className="layers-panel__row-actions">
            <button
              type="button"
              className={clsx("layers-panel__icon-btn", {
                "layers-panel__icon-btn--active": allLocked,
              })}
              title={
                allLocked ? t("layersPanel.unlock") : t("layersPanel.lock")
              }
              onClick={(event) => {
                event.stopPropagation();
                run(actionSetLayerProperty, {
                  elementIds: ids,
                  property: "locked",
                });
              }}
            >
              {allLocked ? LockedIcon : UnlockedIcon}
            </button>
            <button
              type="button"
              className={clsx("layers-panel__icon-btn", {
                "layers-panel__icon-btn--active": allHidden,
              })}
              title={allHidden ? t("layersPanel.show") : t("layersPanel.hide")}
              onClick={(event) => {
                event.stopPropagation();
                run(actionSetLayerProperty, {
                  elementIds: ids,
                  property: "hidden",
                });
              }}
            >
              <EyeIcon hidden={allHidden} />
            </button>
            <button
              type="button"
              className="layers-panel__icon-btn layers-panel__icon-btn--danger"
              title={t("layersPanel.delete")}
              onClick={(event) => {
                event.stopPropagation();
                removeElements(ids);
              }}
            >
              {TrashIcon}
            </button>
          </span>
        </div>
        {!collapsed &&
          node.children.map((child) =>
            child.type === "group"
              ? renderGroupNode(child)
              : renderElementRow(child.element, node.depth + 1),
          )}
      </div>
    );
  };

  return (
    <div
      className={clsx("layers-panel", {
        "layers-panel--collapsed-sidebar": !appState.isLayersPanelOpen,
      })}
    >
      <div className="layers-panel__header">
        <span className="layers-panel__title">{t("layersPanel.title")}</span>
      </div>
      <div className="layers-panel__search">
        <input
          type="text"
          value={query}
          placeholder={t("layersPanel.searchPlaceholder")}
          onChange={(event) =>
            setAppState({ layerSearchQuery: event.target.value })
          }
        />
        {query && (
          <button
            type="button"
            className="layers-panel__search-clear"
            onClick={() => setAppState({ layerSearchQuery: "" })}
          >
            ×
          </button>
        )}
      </div>
      <div
        className="layers-panel__list"
        onDragOver={onContainerDragOver}
        onDrop={onContainerDrop}
      >
        {(searchNodes || tree).length === 0 ? (
          <div className="layers-panel__empty">
            {matchSet
              ? t("layersPanel.noSearchResults")
              : t("layersPanel.empty")}
          </div>
        ) : (
          (searchNodes || tree).map((node) =>
            node.type === "group"
              ? renderGroupNode(node)
              : renderElementRow(node.element, 0),
          )
        )}
      </div>
      <div className="layers-panel__toolbar">
        {selectedCount > 0 && (
          <>
            <ToolButton
              type="button"
              icon={<GroupIcon theme={appState.theme} />}
              title={t("layersPanel.groupSelected")}
              aria-label={t("layersPanel.groupSelected")}
              onClick={() => run(actionGroup)}
            />
            <ToolButton
              type="button"
              icon={<UngroupIcon theme={appState.theme} />}
              title={t("layersPanel.ungroupSelected")}
              aria-label={t("layersPanel.ungroupSelected")}
              hidden={selectedGroupIds.length === 0}
              onClick={() => run(actionUngroup)}
            />
            <span className="layers-panel__toolbar-divider" />
            {alignButtons.map(({ action, title, icon }) => (
              <ToolButton
                key={action.name}
                type="button"
                icon={icon}
                title={t(title)}
                aria-label={t(title)}
                onClick={() => run(action)}
              />
            ))}
            <span className="layers-panel__toolbar-divider" />
            <ToolButton
              type="button"
              icon={TrashIcon}
              title={t("layersPanel.delete")}
              aria-label={t("layersPanel.delete")}
              onClick={() => removeElements(Array.from(selectedIds))}
            />
          </>
        )}
      </div>
      {selectedCount > 0 && (
        <div className="layers-panel__footer">
          {t("layersPanel.itemsSelected", { count: selectedCount })}
        </div>
      )}
    </div>
  );
};
