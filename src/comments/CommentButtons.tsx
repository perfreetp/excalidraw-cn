import "../components/ToolIcon.scss";

import clsx from "clsx";
import { t } from "../i18n";
import { commentsStore, useCommentsState } from "./commentsStore";

const commentIcon = (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const commentListIcon = (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    <line x1="8" y1="9" x2="16" y2="9" />
    <line x1="8" y1="13" x2="13" y2="13" />
  </svg>
);

export const CommentModeButton = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) => {
  return (
    <label
      className={clsx("ToolIcon", "ToolIcon_size_medium")}
      title={t("comments.mode")}
    >
      <input
        className="ToolIcon_type_checkbox"
        type="checkbox"
        name="editor-comment-mode"
        onChange={onChange}
        checked={checked}
        aria-label={t("comments.mode")}
        data-testid="toolbar-comment-mode"
      />
      <div className="ToolIcon__icon">{commentIcon}</div>
    </label>
  );
};

export const CommentPanelButton = () => {
  const { panelOpen, threads } = useCommentsState();
  const unresolvedCount = threads.filter((thread) => !thread.resolved).length;
  return (
    <label
      className={clsx("ToolIcon", "ToolIcon_size_medium")}
      title={t("comments.title")}
    >
      <input
        className="ToolIcon_type_checkbox"
        type="checkbox"
        name="editor-comment-panel"
        onChange={() => commentsStore.togglePanel()}
        checked={panelOpen}
        aria-label={t("comments.title")}
        data-testid="toolbar-comment-panel"
      />
      <div className="ToolIcon__icon">
        <span style={{ position: "relative", display: "inline-flex" }}>
          {commentListIcon}
          {unresolvedCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -10,
                background: "#e03131",
                color: "#fff",
                borderRadius: 8,
                fontSize: 9,
                lineHeight: "12px",
                minWidth: 12,
                textAlign: "center",
                padding: "0 2px",
              }}
            >
              {unresolvedCount}
            </span>
          )}
        </span>
      </div>
    </label>
  );
};
