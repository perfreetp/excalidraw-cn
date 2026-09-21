import React, { useMemo } from "react";
import clsx from "clsx";
import { useAtom } from "jotai";
import { AppState } from "../types";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { jotaiScope } from "../jotai";
import {
  activeCommentIdAtom,
  commentFilterAtom,
  commentPanelOpenAtom,
  commentsAtom,
  toggleCommentResolved,
} from "./store";
import {
  downloadCommentsText,
  formatTime,
  getCommentColor,
  getCommentScenePosition,
} from "./commentUtils";
import { CommentFilter } from "./types";

const FILTERS: CommentFilter[] = ["all", "open", "resolved"];

export const CommentSidebar = ({
  appState,
  elements,
  setAppState,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  setAppState: React.Component<any, AppState>["setState"];
}) => {
  const [open, setOpen] = useAtom(commentPanelOpenAtom, jotaiScope);
  const [comments] = useAtom(commentsAtom, jotaiScope);
  const [filter, setFilter] = useAtom(commentFilterAtom, jotaiScope);
  const [activeCommentId, setActiveCommentId] = useAtom(
    activeCommentIdAtom,
    jotaiScope,
  );

  const elementsMap = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );

  const filteredComments = useMemo(() => {
    const sorted = [...comments].sort((a, b) => a.number - b.number);
    if (filter === "open") {
      return sorted.filter((comment) => !comment.resolved);
    }
    if (filter === "resolved") {
      return sorted.filter((comment) => comment.resolved);
    }
    return sorted;
  }, [comments, filter]);

  if (!open) {
    return null;
  }

  const focusComment = (commentId: string) => {
    const comment = comments.find((item) => item.id === commentId);
    if (!comment) {
      return;
    }
    const position = getCommentScenePosition(comment, elementsMap) || {
      x: comment.x,
      y: comment.y,
    };
    // 将视图平移到评论所在位置（居中显示）
    setAppState({
      scrollX: appState.width / 2 / appState.zoom.value - position.x,
      scrollY: appState.height / 2 / appState.zoom.value - position.y,
    });
    setActiveCommentId(commentId);
  };

  return (
    <aside className="comment-sidebar">
      <div className="comment-sidebar__header">
        <span className="comment-sidebar__title">
          {t("comments.title")}
          <span className="comment-sidebar__count">{comments.length}</span>
        </span>
        <div className="comment-sidebar__header-actions">
          <button
            className="comment-btn"
            title={t("comments.export")}
            onClick={() => downloadCommentsText(comments)}
          >
            {t("comments.export")}
          </button>
          <button
            className="comment-popup__close"
            onClick={() => setOpen(false)}
            aria-label={t("buttons.close")}
          >
            ×
          </button>
        </div>
      </div>
      <div className="comment-sidebar__filters">
        {FILTERS.map((item) => (
          <button
            key={item}
            className={clsx("comment-sidebar__filter", {
              "comment-sidebar__filter--active": filter === item,
            })}
            onClick={() => setFilter(item)}
          >
            {t(`comments.filter.${item}`)}
          </button>
        ))}
      </div>
      <div className="comment-sidebar__list">
        {filteredComments.length === 0 && (
          <div className="comment-sidebar__empty">{t("comments.empty")}</div>
        )}
        {filteredComments.map((comment) => (
          <div
            key={comment.id}
            className={clsx("comment-sidebar__item", {
              "comment-sidebar__item--active": comment.id === activeCommentId,
              "comment-sidebar__item--resolved": comment.resolved,
            })}
            onClick={() => focusComment(comment.id)}
          >
            <span
              className="comment-bubble__number"
              style={{
                background: comment.resolved
                  ? "var(--color-gray-40, #adb5bd)"
                  : getCommentColor(comment),
              }}
            >
              {comment.resolved ? "✓" : comment.number}
            </span>
            <div className="comment-sidebar__item-main">
              <div className="comment-sidebar__item-text">{comment.text}</div>
              <div className="comment-sidebar__item-meta">
                <span>{comment.author || t("comments.anonymous")}</span>
                <span>{formatTime(comment.createdAt)}</span>
                {comment.replies.length > 0 && (
                  <span>
                    {t("comments.replyCount", {
                      count: comment.replies.length,
                    })}
                  </span>
                )}
                {comment.orphaned && (
                  <span className="comment-sidebar__orphan">
                    {t("comments.orphanedShort")}
                  </span>
                )}
              </div>
            </div>
            <button
              className="comment-link comment-sidebar__resolve"
              title={
                comment.resolved
                  ? t("comments.reopen")
                  : t("comments.markResolved")
              }
              onClick={(event) => {
                event.stopPropagation();
                toggleCommentResolved(comment.id);
              }}
            >
              {comment.resolved ? "↩" : "✓"}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
};
