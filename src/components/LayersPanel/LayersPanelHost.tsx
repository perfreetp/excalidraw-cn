import clsx from "clsx";
import React from "react";
import { ActionManager } from "../../actions/manager";
import { t } from "../../i18n";
import { NonDeletedExcalidrawElement } from "../../element/types";
import { AppState } from "../../types";
import { LayersPanel } from "./LayersPanel";

interface LayersPanelHostProps {
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  actionManager: ActionManager;
  canvas: HTMLCanvasElement | null;
}

const LayersIcon = () => (
  <svg
    aria-hidden="true"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

export const LayersPanelHost: React.FC<LayersPanelHostProps> = (props) => {
  const { appState, setAppState } = props;
  const open = appState.isLayersPanelOpen;

  return (
    <div
      className={clsx("layers-panel-host", {
        "layers-panel-host--hidden": !open,
      })}
    >
      {open && <LayersPanel {...props} />}
      <button
        type="button"
        className="layers-panel-toggle"
        style={open ? { right: 272 } : undefined}
        title={t("layersPanel.togglePanel")}
        aria-label={t("layersPanel.togglePanel")}
        onClick={() => setAppState({ isLayersPanelOpen: !open })}
      >
        <LayersIcon />
      </button>
    </div>
  );
};
