import clsx from "clsx";
import moment from "moment";
import React from "react";
import { AppState } from "../types";
import { t } from "../i18n";
import { getContainerNameFromStorage } from "../excalidraw-app/data/localStorage";
import {
  commentsStore,
  getThreadPosition,
  useCommentsState,
} from "./commentsStore";
import { getBubbleColor } from "./CommentLayer";
import { CommentsFilter, CommentThread } from "./types";
import "./Comments.scss";

const FILTERS: CommentsFilter[] = ["all", "unresolved", "resolved"];

const buildExportText = (threads: CommentThread[]): string => {
  const canvasName = getContainerNameFromStorage();
  const lines: string[] = [
    `${t("comments.exportTitle", { name: canvasName })}`,
    `${t("comments.exportedAt")}: ${moment().format("YYYY-MM-DD HH:mm:ss")}`,
    "",
  ];
  const sorted = [...threads].sort((a, b) => a.number - b.number);
  for (const thread of sorted) {
    const status = thread.resolved
      ? t("comments.resolved")
      : t("comments.unresolved");
    const anchor = thread.elementId
      ? t("comments.anchored")
      : thread.orphaned
      ? t("comments.orphaned")
      : t("comments.onCanvas");
    lines.push(
      `#${thread.number} [${status}] (${Math.round(thread.x)}, ${Math.round(
        thread.y,
      )}) ${anchor}`,
    );
    for (const message of thread.messages) {
      lines.push(
        `  - ${message.author || t("comments.defaultAuthor")} ${moment(
          message.createdAt,
        ).format("YYYY-MM-DD HH:mm")}: ${message.text}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
};

const exportThreads = (threads: CommentThread[]) => {
  const text = buildExportText(threads);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `comments-${getContainerNameFromStorage()}-${moment().format(
    "YYYYMMDDHHmmss",
  )}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const CommentsSidebar = ({
  appState,
  setAppState,
}: {
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
}) => {
  const { threads, panelOpen, filter, activeThreadId, elements } =
    useCommentsState();

  if (!panelOpen) {
    return null;
  }

  const counts = {
    all: threads.length,
    unresolved: threads.filter((thread) => !thread.resolved).length,
    resolved: threads.filter((thread) => thread.resolved).length,
  };

  const visibleThreads = [...threads]
    .filter((thread) => {
      if (filter === "unresolved") {
        return !thread.resolved;
      }
      if (filter === "resolved") {
        return thread.resolved;
      }
      return true;
    })
    .sort((a, b) => a.number - b.number);

  const focusThread = (thread: CommentThread) => {
    const position = getThreadPosition(thread, elements);
    // 将视图平移到评论所在位置（居中显示）
    setAppState({
      scrollX: appState.width / 2 / appState.zoom.value - position.x,
      scrollY: appState.height / 2 / appState.zoom.value - position.y,
    });
    commentsStore.highlightThread(thread.id);
  };

  return (
    <div className="comments-sidebar">
      <div className="comments-sidebar__header">
        <span className="comments-sidebar__title">{t("comments.title")}</span>
        <div className="comments-sidebar__header-actions">
          <button
            className="comment-btn"
            disabled={!threads.length}
            title={t("comments.export")}
            onClick={() => exportThreads(threads)}
          >
            {t("comments.export")}
          </button>
          <button
            className="comment-btn comment-btn--link"
            onClick={() => commentsStore.setPanelOpen(false)}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="comments-sidebar__filters">
        {FILTERS.map((item) => (
          <button
            key={item}
            className={clsx("comments-sidebar__filter", {
              "comments-sidebar__filter--active": filter === item,
            })}
            onClick={() => commentsStore.setFilter(item)}
          >
            {t(`comments.filter.${item}`)} ({counts[item]})
          </button>
        ))}
      </div>
      <div className="comments-sidebar__list">
        {visibleThreads.length === 0 && (
          <div className="comments-sidebar__empty">{t("comments.empty")}</div>
        )}
        {visibleThreads.map((thread) => {
          const firstMessage = thread.messages[0];
          return (
            <div
              key={thread.id}
              className={clsx("comments-sidebar__item", {
                "comments-sidebar__item--resolved": thread.resolved,
                "comments-sidebar__item--active": thread.id === activeThreadId,
              })}
              onClick={() => focusThread(thread)}
            >
              <span
                className="comments-sidebar__item-number"
                style={{
                  background: thread.resolved
                    ? "#adb5bd"
                    : getBubbleColor(thread),
                }}
              >
                {thread.resolved ? "✓" : thread.number}
              </span>
              <div className="comments-sidebar__item-body">
                <div className="comments-sidebar__item-text">
                  {firstMessage?.text}
                </div>
                <div className="comments-sidebar__item-meta">
                  <span>{firstMessage?.author}</span>
                  <span>
                    {t("comments.messageCount", {
                      count: thread.messages.length,
                    })}
                  </span>
                  {thread.orphaned && (
                    <span className="comments-sidebar__item-orphaned">
                      {t("comments.orphaned")}
                    </span>
                  )}
                  {thread.resolved && (
                    <span className="comments-sidebar__item-resolved">
                      {t("comments.resolved")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
