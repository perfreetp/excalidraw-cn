import { atom } from "jotai";
import { nanoid } from "nanoid";
import { jotaiStore } from "../jotai";
import { importUsernameFromLocalStorage } from "../excalidraw-app/data/localStorage";
import { loadCommentsFromStorage, saveCommentsToStorage } from "./storage";
import { CommentFilter, CommentThread, DraftComment } from "./types";

/** 批注模式开关：开启后点击画布即可放置评论 */
export const commentModeAtom = atom(false);

/** 当前画布的评论列表（按画布分别持久化到 localStorage） */
export const commentsAtom = atom<CommentThread[]>(loadCommentsFromStorage());

/** 左侧评论列表面板开关 */
export const commentPanelOpenAtom = atom(false);

/** 评论列表筛选 */
export const commentFilterAtom = atom<CommentFilter>("all");

/** 当前高亮/打开的评论 id */
export const activeCommentIdAtom = atom<string | null>(null);

/** 待输入内容的草稿评论（点击画布后弹出输入框） */
export const draftCommentAtom = atom<DraftComment | null>(null);

// 持久化：评论变化时写入当前画布对应的 localStorage key
jotaiStore.sub(commentsAtom, () => {
  saveCommentsToStorage(jotaiStore.get(commentsAtom) ?? []);
});

const getAuthorName = () => {
  return importUsernameFromLocalStorage() || "";
};

const updateComment = (
  id: string,
  updater: (comment: CommentThread) => CommentThread,
) => {
  jotaiStore.set(commentsAtom, (comments) =>
    comments.map((comment) =>
      comment.id === id
        ? { ...updater(comment), updatedAt: Date.now() }
        : comment,
    ),
  );
};

export const openDraftComment = (draft: DraftComment) => {
  jotaiStore.set(draftCommentAtom, draft);
  jotaiStore.set(activeCommentIdAtom, null);
};

export const cancelDraftComment = () => {
  jotaiStore.set(draftCommentAtom, null);
};

export const commitDraftComment = (text: string) => {
  const draft = jotaiStore.get(draftCommentAtom);
  const trimmed = text.trim();
  if (!draft || !trimmed) {
    return;
  }
  const now = Date.now();
  jotaiStore.set(commentsAtom, (comments) => {
    const nextNumber =
      comments.reduce((max, comment) => Math.max(max, comment.number), 0) + 1;
    const comment: CommentThread = {
      id: nanoid(),
      number: nextNumber,
      x: draft.x,
      y: draft.y,
      elementId: draft.elementId,
      offsetFx: draft.offsetFx,
      offsetFy: draft.offsetFy,
      orphaned: false,
      resolved: false,
      author: getAuthorName(),
      text: trimmed,
      replies: [],
      createdAt: now,
      updatedAt: now,
    };
    return [...comments, comment];
  });
  jotaiStore.set(draftCommentAtom, null);
};

export const addReply = (commentId: string, text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  const now = Date.now();
  updateComment(commentId, (comment) => ({
    ...comment,
    replies: [
      ...comment.replies,
      {
        id: nanoid(),
        author: getAuthorName(),
        text: trimmed,
        createdAt: now,
        updatedAt: now,
      },
    ],
  }));
};

export const editCommentText = (commentId: string, text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  updateComment(commentId, (comment) => ({ ...comment, text: trimmed }));
};

export const editReply = (commentId: string, replyId: string, text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  updateComment(commentId, (comment) => ({
    ...comment,
    replies: comment.replies.map((reply) =>
      reply.id === replyId
        ? { ...reply, text: trimmed, updatedAt: Date.now() }
        : reply,
    ),
  }));
};

export const deleteComment = (commentId: string) => {
  jotaiStore.set(commentsAtom, (comments) =>
    comments.filter((comment) => comment.id !== commentId),
  );
  if (jotaiStore.get(activeCommentIdAtom) === commentId) {
    jotaiStore.set(activeCommentIdAtom, null);
  }
};

export const deleteReply = (commentId: string, replyId: string) => {
  updateComment(commentId, (comment) => ({
    ...comment,
    replies: comment.replies.filter((reply) => reply.id !== replyId),
  }));
};

export const toggleCommentResolved = (commentId: string) => {
  updateComment(commentId, (comment) => ({
    ...comment,
    resolved: !comment.resolved,
  }));
};

/** 锚定图形被删除后，将评论固定在最后的已知位置并标记失去锚点 */
export const markCommentOrphaned = (
  commentId: string,
  x: number,
  y: number,
) => {
  updateComment(commentId, (comment) => ({
    ...comment,
    elementId: null,
    orphaned: true,
    x,
    y,
  }));
};
