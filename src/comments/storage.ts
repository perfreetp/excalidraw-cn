import { STORAGE_KEYS } from "../excalidraw-app/app_constants";
import { CommentThread } from "./types";

/** 旧版本（未按画布区分）的评论存储 key，用于平滑迁移 */
const LEGACY_COMMENTS_KEY = "excalidraw-comments";

const getContainerName = () =>
  localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_CONTAINER_NAME) ||
  STORAGE_KEYS.LOCAL_STORAGE_DEFAULT_CONTAINER_NAME;

export const getCommentsStorageKey = (containerName: string) =>
  `${STORAGE_KEYS.LOCAL_STORAGE_COMMENTS_PREFIX}${containerName}`;

const isValidComment = (comment: any): comment is CommentThread => {
  return (
    comment &&
    typeof comment.id === "string" &&
    typeof comment.x === "number" &&
    typeof comment.y === "number" &&
    typeof comment.text === "string"
  );
};

const normalizeComment = (comment: any, index: number): CommentThread => {
  return {
    id: comment.id,
    number: typeof comment.number === "number" ? comment.number : index + 1,
    x: comment.x,
    y: comment.y,
    elementId: typeof comment.elementId === "string" ? comment.elementId : null,
    offsetFx: typeof comment.offsetFx === "number" ? comment.offsetFx : 0,
    offsetFy: typeof comment.offsetFy === "number" ? comment.offsetFy : 0,
    orphaned: Boolean(comment.orphaned),
    resolved: Boolean(comment.resolved),
    author: typeof comment.author === "string" ? comment.author : "",
    text: comment.text,
    replies: Array.isArray(comment.replies) ? comment.replies : [],
    createdAt: typeof comment.createdAt === "number" ? comment.createdAt : 0,
    updatedAt: typeof comment.updatedAt === "number" ? comment.updatedAt : 0,
  };
};

export const loadCommentsFromStorage = (
  containerName: string = getContainerName(),
): CommentThread[] => {
  let comments: CommentThread[] = [];
  try {
    const raw = localStorage.getItem(getCommentsStorageKey(containerName));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        comments = parsed.filter(isValidComment).map(normalizeComment);
      }
    }
  } catch (error: any) {
    console.error(error);
  }

  // 旧数据平滑迁移：全局 key 中的评论并入当前画布，迁移后删除旧 key
  try {
    const legacyRaw = localStorage.getItem(LEGACY_COMMENTS_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed) && parsed.length) {
        const legacyComments = parsed
          .filter(isValidComment)
          .map(normalizeComment);
        const existingIds = new Set(comments.map((comment) => comment.id));
        const maxNumber = comments.reduce(
          (max, comment) => Math.max(max, comment.number),
          0,
        );
        let nextNumber = maxNumber;
        const merged = [...comments];
        legacyComments.forEach((comment) => {
          if (!existingIds.has(comment.id)) {
            nextNumber += 1;
            merged.push({ ...comment, number: nextNumber });
          }
        });
        comments = merged;
        saveCommentsToStorage(comments, containerName);
      }
      localStorage.removeItem(LEGACY_COMMENTS_KEY);
    }
  } catch (error: any) {
    console.error(error);
  }

  return comments;
};

export const saveCommentsToStorage = (
  comments: CommentThread[],
  containerName: string = getContainerName(),
) => {
  try {
    localStorage.setItem(
      getCommentsStorageKey(containerName),
      JSON.stringify(comments),
    );
  } catch (error: any) {
    console.error(error);
  }
};

/** 画布重命名时同步迁移评论数据 */
export const renameCommentsStorage = (oldName: string, newName: string) => {
  try {
    const raw = localStorage.getItem(getCommentsStorageKey(oldName));
    if (raw !== null) {
      localStorage.setItem(getCommentsStorageKey(newName), raw);
      localStorage.removeItem(getCommentsStorageKey(oldName));
    }
  } catch (error: any) {
    console.error(error);
  }
};

/** 画布删除时清理对应评论数据 */
export const removeCommentsStorage = (containerName: string) => {
  try {
    localStorage.removeItem(getCommentsStorageKey(containerName));
  } catch (error: any) {
    console.error(error);
  }
};
