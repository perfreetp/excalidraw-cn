import clsx from "clsx";
import moment from "moment";
import React, { useEffect, useRef, useState } from "react";
import { AppState } from "../types";
import { t } from "../i18n";
import { sceneCoordsToViewportCoords } from "../utils";
import {
  commentsStore,
  getCommentAuthor,
  getThreadPosition,
  useCommentsState,
} from "./commentsStore";
import { CommentThread } from "./types";
import "./Comments.scss";

const BUBBLE_COLORS = [
  "#1971c2",
  "#e8590c",
  "#2f9e44",
  "#9c36b5",
  "#e03131",
  "#f08c00",
  "#0c8599",
];

export const getBubbleColor = (thread: CommentThread) =>
  BUBBLE_COLORS[(thread.number - 1) % BUBBLE_COLORS.length];

const formatTime = (timestamp: number) =>
  moment(timestamp).format("YYYY-MM-DD HH:mm");

const MessageItem = ({
  thread,
  messageId,
}: {
  thread: CommentThread;
  messageId: string;
}) => {
  const message = thread.messages.find((item) => item.id === messageId)!;
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(message.text);

  const commitEdit = () => {
    if (draftText.trim()) {
      commentsStore.editMessage(thread.id, message.id, draftText);
      setEditing(false);
    }
  };

  return (
    <div className="comment-message">
      <div className="comment-message__meta">
        <span className="comment-message__author">
          {message.author || t("comments.defaultAuthor")}
        </span>
        <span className="comment-message__time">
          {formatTime(message.createdAt)}
          {message.updatedAt ? ` (${t("comments.edited")})` : ""}
        </span>
      </div>
      {editing ? (
        <div className="comment-message__editor">
          <textarea
            autoFocus
            value={draftText}
            rows={2}
            onChange={(event) => setDraftText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                commitEdit();
              }
              if (event.key === "Escape") {
                setEditing(false);
                setDraftText(message.text);
              }
            }}
          />
          <div className="comment-message__editor-actions">
            <button
              className="comment-btn comment-btn--primary"
              onClick={commitEdit}
            >
              {t("comments.save")}
            </button>
            <button
              className="comment-btn"
              onClick={() => {
                setEditing(false);
                setDraftText(message.text);
              }}
            >
              {t("comments.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="comment-message__text">{message.text}</div>
          <div className="comment-message__actions">
            <button
              className="comment-btn comment-btn--link"
              onClick={() => {
                setDraftText(message.text);
                setEditing(true);
              }}
            >
              {t("comments.edit")}
            </button>
            <button
              className="comment-btn comment-btn--link comment-btn--danger"
              onClick={() => commentsStore.deleteMessage(thread.id, message.id)}
            >
              {t("comments.delete")}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const ThreadPopover = ({
  thread,
  left,
  top,
}: {
  thread: CommentThread;
  left: number;
  top: number;
}) => {
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [thread.id]);

  const submitReply = () => {
    if (replyText.trim()) {
      commentsStore.addMessage(thread.id, replyText);
      setReplyText("");
    }
  };

  return (
    <div
      className="comment-popover"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="comment-popover__header">
        <span
          className="comment-popover__number"
          style={{
            background: thread.resolved ? "#adb5bd" : getBubbleColor(thread),
          }}
        >
          #{thread.number}
        </span>
        <span className="comment-popover__status">
          {thread.orphaned && (
            <span className="comment-popover__orphaned">
              {t("comments.orphaned")}
            </span>
          )}
          {thread.resolved && (
            <span className="comment-popover__resolved">
              {t("comments.resolved")}
            </span>
          )}
        </span>
        <button
          className="comment-btn comment-btn--link"
          onClick={() => commentsStore.setActiveThread(null)}
        >
          ✕
        </button>
      </div>
      <div className="comment-popover__messages">
        {thread.messages.map((message) => (
          <MessageItem
            key={message.id}
            thread={thread}
            messageId={message.id}
          />
        ))}
      </div>
      <div className="comment-popover__reply">
        <textarea
          ref={inputRef}
          rows={2}
          placeholder={t("comments.replyPlaceholder")}
          value={replyText}
          onChange={(event) => setReplyText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              submitReply();
            }
          }}
        />
        <div className="comment-popover__footer">
          <button
            className="comment-btn"
            onClick={() => commentsStore.toggleResolved(thread.id)}
          >
            {thread.resolved
              ? t("comments.reopen")
              : t("comments.markResolved")}
          </button>
          <button
            className="comment-btn comment-btn--danger"
            onClick={() => commentsStore.deleteThread(thread.id)}
          >
            {t("comments.deleteThread")}
          </button>
          <button
            className="comment-btn comment-btn--primary"
            disabled={!replyText.trim()}
            onClick={submitReply}
          >
            {t("comments.reply")}
          </button>
        </div>
      </div>
    </div>
  );
};

const DraftPopover = ({ left, top }: { left: number; top: number }) => {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (text.trim()) {
      commentsStore.commitDraft(text, getCommentAuthor());
    }
  };

  return (
    <div
      className="comment-popover comment-popover--draft"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="comment-popover__header">
        <span className="comment-popover__title">
          {t("comments.newComment")}
        </span>
        <button
          className="comment-btn comment-btn--link"
          onClick={() => commentsStore.cancelDraft()}
        >
          ✕
        </button>
      </div>
      <div className="comment-popover__reply">
        <textarea
          ref={inputRef}
          rows={3}
          placeholder={t("comments.placeholder")}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              submit();
            }
            if (event.key === "Escape") {
              commentsStore.cancelDraft();
            }
          }}
        />
        <div className="comment-popover__footer">
          <button
            className="comment-btn"
            onClick={() => commentsStore.cancelDraft()}
          >
            {t("comments.cancel")}
          </button>
          <button
            className="comment-btn comment-btn--primary"
            disabled={!text.trim()}
            onClick={submit}
          >
            {t("comments.submit")}
          </button>
        </div>
      </div>
    </div>
  );
};

export const CommentLayer = ({ appState }: { appState: AppState }) => {
  const { threads, draft, activeThreadId, highlightedThreadId, elements } =
    useCommentsState();

  const toViewport = (sceneX: number, sceneY: number) =>
    sceneCoordsToViewportCoords({ sceneX, sceneY }, appState);

  const activeThread = threads.find((thread) => thread.id === activeThreadId);

  return (
    <div className="comment-layer">
      {threads.map((thread) => {
        const position = getThreadPosition(thread, elements);
        const { x, y } = toViewport(position.x, position.y);
        const isActive = thread.id === activeThreadId;
        const isHighlighted = thread.id === highlightedThreadId;
        return (
          <button
            key={thread.id}
            className={clsx("comment-bubble", {
              "comment-bubble--resolved": thread.resolved,
              "comment-bubble--active": isActive,
              "comment-bubble--highlighted": isHighlighted,
              "comment-bubble--orphaned": thread.orphaned,
            })}
            style={{
              left: x,
              top: y,
              ...(thread.resolved
                ? {}
                : { background: getBubbleColor(thread) }),
            }}
            title={
              thread.orphaned
                ? t("comments.orphaned")
                : `${t("comments.comment")} #${thread.number}`
            }
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              commentsStore.setActiveThread(isActive ? null : thread.id);
            }}
          >
            {thread.resolved ? "✓" : thread.number}
          </button>
        );
      })}
      {draft &&
        (() => {
          const position = getThreadPosition(draft, elements);
          const { x, y } = toViewport(position.x, position.y);
          return (
            <>
              <span
                className="comment-bubble comment-bubble--draft"
                style={{ left: x, top: y }}
              >
                +
              </span>
              <DraftPopover left={x + 20} top={y + 20} />
            </>
          );
        })()}
      {activeThread &&
        (() => {
          const position = getThreadPosition(activeThread, elements);
          const { x, y } = toViewport(position.x, position.y);
          return (
            <ThreadPopover thread={activeThread} left={x + 20} top={y + 20} />
          );
        })()}
    </div>
  );
};
