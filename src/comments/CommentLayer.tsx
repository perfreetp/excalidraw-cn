import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useAtom } from "jotai";
import { AppState } from "../types";
import { NonDeletedExcalidrawElement } from "../element/types";
import { sceneCoordsToViewportCoords } from "../utils";
import { t } from "../i18n";
import { jotaiScope } from "../jotai";
import {
  activeCommentIdAtom,
  addReply,
  cancelDraftComment,
  commentModeAtom,
  commentsAtom,
  commitDraftComment,
  deleteComment,
  deleteReply,
  draftCommentAtom,
  editCommentText,
  editReply,
  markCommentOrphaned,
  toggleCommentResolved,
} from "./store";
import {
  formatTime,
  getCommentColor,
  getCommentScenePosition,
} from "./commentUtils";
import { CommentThread } from "./types";
import "./Comments.scss";

const POPUP_WIDTH = 300;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const CommentPopup = ({
  comment,
  left,
  top,
  onClose,
}: {
  comment: CommentThread;
  left: number;
  top: number;
  onClose: () => void;
}) => {
  const [replyText, setReplyText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyText, setEditingReplyText] = useState("");

  return (
    <div
      className="comment-popup"
      style={{ left, top, width: POPUP_WIDTH }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="comment-popup__header">
        <span
          className="comment-bubble__number"
          style={{ background: getCommentColor(comment) }}
        >
          {comment.number}
        </span>
        <span className="comment-popup__author">
          {comment.author || t("comments.anonymous")}
        </span>
        <span className="comment-popup__time">
          {formatTime(comment.createdAt)}
        </span>
        <button
          className="comment-popup__close"
          onClick={onClose}
          aria-label={t("buttons.close")}
        >
          ×
        </button>
      </div>
      {comment.orphaned && (
        <div className="comment-popup__orphan-hint">
          {t("comments.orphanedHint")}
        </div>
      )}
      <div className="comment-popup__body">
        {editing ? (
          <div className="comment-popup__editor">
            <textarea
              value={editText}
              autoFocus
              rows={3}
              onChange={(event) => setEditText(event.target.value)}
            />
            <div className="comment-popup__editor-actions">
              <button
                className="comment-btn comment-btn--primary"
                onClick={() => {
                  editCommentText(comment.id, editText);
                  setEditing(false);
                }}
              >
                {t("buttons.save")}
              </button>
              <button
                className="comment-btn"
                onClick={() => {
                  setEditing(false);
                  setEditText(comment.text);
                }}
              >
                {t("buttons.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="comment-popup__text">{comment.text}</div>
        )}
        {comment.replies.map((reply) => (
          <div className="comment-popup__reply" key={reply.id}>
            <div className="comment-popup__reply-meta">
              <span className="comment-popup__author">
                {reply.author || t("comments.anonymous")}
              </span>
              <span className="comment-popup__time">
                {formatTime(reply.createdAt)}
              </span>
              <button
                className="comment-link"
                onClick={() => {
                  setEditingReplyId(reply.id);
                  setEditingReplyText(reply.text);
                }}
              >
                {t("comments.edit")}
              </button>
              <button
                className="comment-link comment-link--danger"
                onClick={() => {
                  if (window.confirm(t("comments.confirmDeleteReply"))) {
                    deleteReply(comment.id, reply.id);
                  }
                }}
              >
                {t("comments.delete")}
              </button>
            </div>
            {editingReplyId === reply.id ? (
              <div className="comment-popup__editor">
                <textarea
                  value={editingReplyText}
                  autoFocus
                  rows={2}
                  onChange={(event) => setEditingReplyText(event.target.value)}
                />
                <div className="comment-popup__editor-actions">
                  <button
                    className="comment-btn comment-btn--primary"
                    onClick={() => {
                      editReply(comment.id, reply.id, editingReplyText);
                      setEditingReplyId(null);
                    }}
                  >
                    {t("buttons.save")}
                  </button>
                  <button
                    className="comment-btn"
                    onClick={() => setEditingReplyId(null)}
                  >
                    {t("buttons.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="comment-popup__reply-text">{reply.text}</div>
            )}
          </div>
        ))}
      </div>
      <div className="comment-popup__reply-input">
        <textarea
          placeholder={t("comments.replyPlaceholder")}
          value={replyText}
          rows={2}
          onChange={(event) => setReplyText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              addReply(comment.id, replyText);
              setReplyText("");
            }
          }}
        />
        <button
          className="comment-btn comment-btn--primary"
          disabled={!replyText.trim()}
          onClick={() => {
            addReply(comment.id, replyText);
            setReplyText("");
          }}
        >
          {t("comments.reply")}
        </button>
      </div>
      <div className="comment-popup__footer">
        {!editing && (
          <button
            className="comment-link"
            onClick={() => {
              setEditing(true);
              setEditText(comment.text);
            }}
          >
            {t("comments.edit")}
          </button>
        )}
        <button
          className="comment-link comment-link--danger"
          onClick={() => {
            if (window.confirm(t("comments.confirmDelete"))) {
              deleteComment(comment.id);
            }
          }}
        >
          {t("comments.delete")}
        </button>
        <button
          className={clsx("comment-btn", {
            "comment-btn--primary": !comment.resolved,
          })}
          onClick={() => toggleCommentResolved(comment.id)}
        >
          {comment.resolved ? t("comments.reopen") : t("comments.markResolved")}
        </button>
      </div>
    </div>
  );
};

const DraftPopup = ({ left, top }: { left: number; top: number }) => {
  const [text, setText] = useState("");
  return (
    <div
      className="comment-popup comment-popup--draft"
      style={{ left, top, width: POPUP_WIDTH }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="comment-popup__header">
        <span className="comment-popup__title">{t("comments.newComment")}</span>
        <button
          className="comment-popup__close"
          onClick={cancelDraftComment}
          aria-label={t("buttons.close")}
        >
          ×
        </button>
      </div>
      <div className="comment-popup__reply-input">
        <textarea
          autoFocus
          placeholder={t("comments.placeholder")}
          value={text}
          rows={3}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              commitDraftComment(text);
            } else if (event.key === "Escape") {
              cancelDraftComment();
            }
          }}
        />
        <button
          className="comment-btn comment-btn--primary"
          disabled={!text.trim()}
          onClick={() => commitDraftComment(text)}
        >
          {t("comments.submit")}
        </button>
      </div>
    </div>
  );
};

export const CommentLayer = ({
  appState,
  elements,
  setToast,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  setToast: (toast: { message: string; duration?: number } | null) => void;
}) => {
  const [comments] = useAtom(commentsAtom, jotaiScope);
  const [activeCommentId, setActiveCommentId] = useAtom(
    activeCommentIdAtom,
    jotaiScope,
  );
  const [draft] = useAtom(draftCommentAtom, jotaiScope);
  const [commentMode, setCommentMode] = useAtom(commentModeAtom, jotaiScope);

  const elementsMap = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );

  // 记录每条评论最近一次渲染位置，用于图形删除后将评论固定在最后位置
  const lastPositionsRef = useRef(new Map<string, { x: number; y: number }>());

  // 检测锚定图形被删除的评论，标记为失去锚点并提示
  useEffect(() => {
    comments.forEach((comment) => {
      if (
        comment.elementId &&
        !comment.orphaned &&
        !elementsMap.has(comment.elementId)
      ) {
        const lastPosition = lastPositionsRef.current.get(comment.id);
        markCommentOrphaned(
          comment.id,
          lastPosition?.x ?? comment.x,
          lastPosition?.y ?? comment.y,
        );
        setToast({ message: t("comments.orphanedToast") });
      }
    });
  }, [comments, elementsMap, setToast]);

  // 批注模式下画布使用十字光标
  useEffect(() => {
    document.body.classList.toggle("comment-mode-active", commentMode);
    return () => {
      document.body.classList.remove("comment-mode-active");
    };
  }, [commentMode]);

  // Esc 退出批注模式 / 关闭弹窗
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (draft) {
        cancelDraftComment();
      } else if (activeCommentId) {
        setActiveCommentId(null);
      } else if (commentMode) {
        setCommentMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draft, activeCommentId, commentMode, setActiveCommentId, setCommentMode]);

  const toViewport = (sceneX: number, sceneY: number) =>
    sceneCoordsToViewportCoords(
      { sceneX, sceneY },
      {
        zoom: appState.zoom,
        offsetLeft: appState.offsetLeft,
        offsetTop: appState.offsetTop,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      },
    );

  const clampPopup = (viewportX: number, viewportY: number) => ({
    left: clamp(
      viewportX + 16,
      8,
      Math.max(8, appState.width - POPUP_WIDTH - 8),
    ),
    top: clamp(viewportY + 16, 8, Math.max(8, appState.height - 240)),
  });

  const activeComment = comments.find(
    (comment) => comment.id === activeCommentId,
  );

  return (
    <div className="comment-layer">
      {comments.map((comment) => {
        const position = getCommentScenePosition(comment, elementsMap);
        if (!position) {
          return null;
        }
        lastPositionsRef.current.set(comment.id, position);
        const { x, y } = toViewport(position.x, position.y);
        return (
          <button
            key={comment.id}
            className={clsx("comment-bubble", {
              "comment-bubble--resolved": comment.resolved,
              "comment-bubble--active": comment.id === activeCommentId,
              "comment-bubble--orphaned": comment.orphaned,
            })}
            style={{
              left: x,
              top: y,
              ...(comment.resolved
                ? {}
                : { background: getCommentColor(comment) }),
            }}
            title={comment.orphaned ? t("comments.orphanedHint") : comment.text}
            onClick={(event) => {
              event.stopPropagation();
              setActiveCommentId(
                comment.id === activeCommentId ? null : comment.id,
              );
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {comment.resolved ? "✓" : comment.number}
            {comment.orphaned && (
              <span className="comment-bubble__orphan-badge">!</span>
            )}
          </button>
        );
      })}
      {activeComment &&
        (() => {
          const position = getCommentScenePosition(activeComment, elementsMap);
          if (!position) {
            return null;
          }
          const { x, y } = toViewport(position.x, position.y);
          const { left, top } = clampPopup(x, y);
          return (
            <CommentPopup
              comment={activeComment}
              left={left}
              top={top}
              onClose={() => setActiveCommentId(null)}
            />
          );
        })()}
      {draft &&
        (() => {
          const { x, y } = toViewport(draft.x, draft.y);
          const { left, top } = clampPopup(x, y);
          return (
            <>
              <span
                className="comment-bubble comment-bubble--draft"
                style={{ left: x, top: y }}
              >
                +
              </span>
              <DraftPopup left={left} top={top} />
            </>
          );
        })()}
    </div>
  );
};
