import { getContainerNameFromStorage } from "../excalidraw-app/data/localStorage";
import { CommentsByCanvas, CommentThread } from "./types";

export const COMMENTS_STORAGE_KEY = "excalidraw-comments";
/** 历史版本使用过的旧 key，读取时做平滑迁移 */
const LEGACY_COMMENTS_STORAGE_KEYS = [
  "excalidraw_comments",
  "excalidrawComments",
];

const STORAGE_VERSION = 2;

interface CommentsStorageData {
  version: number;
  canvases: CommentsByCanvas;
}

const normalizeMessage = (raw: any, fallbackIndex: number) => {
  const createdAt =
    typeof raw?.createdAt === "number" ? raw.createdAt : Date.now();
  return {
    id: raw?.id ? String(raw.id) : `m-${createdAt}-${fallbackIndex}`,
    author: typeof raw?.author === "string" && raw.author ? raw.author : "",
    text: typeof raw?.text === "string" ? raw.text : String(raw?.text ?? ""),
    createdAt,
    ...(typeof raw?.updatedAt === "number" ? { updatedAt: raw.updatedAt } : {}),
  };
};

const normalizeThread = (raw: any, fallbackIndex: number): CommentThread => {
  const createdAt =
    typeof raw?.createdAt === "number" ? raw.createdAt : Date.now();

  let messages: CommentThread["messages"] = [];
  if (Array.isArray(raw?.messages)) {
    messages = raw.messages.map(normalizeMessage);
  } else if (typeof raw?.content === "string" && raw.content) {
    // 旧格式：单条 content 字段，迁移为首条评论
    messages = [
      normalizeMessage(
        {
          id: raw.id ? `${raw.id}-0` : undefined,
          author: raw.author,
          text: raw.content,
          createdAt,
        },
        0,
      ),
    ];
  }

  return {
    id: raw?.id ? String(raw.id) : `t-${createdAt}-${fallbackIndex}`,
    number:
      typeof raw?.number === "number" && raw.number > 0
        ? raw.number
        : fallbackIndex + 1,
    x: typeof raw?.x === "number" ? raw.x : 0,
    y: typeof raw?.y === "number" ? raw.y : 0,
    elementId: typeof raw?.elementId === "string" ? raw.elementId : null,
    relX: typeof raw?.relX === "number" ? raw.relX : 0,
    relY: typeof raw?.relY === "number" ? raw.relY : 0,
    resolved: Boolean(raw?.resolved),
    orphaned: Boolean(raw?.orphaned),
    messages,
    createdAt,
  };
};

const normalizeThreads = (raw: any): CommentThread[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeThread);
};

/** 保证画布内编号唯一（旧数据可能缺失或重复编号） */
const ensureUniqueNumbers = (threads: CommentThread[]): CommentThread[] => {
  const usedNumbers = new Set<number>();
  let maxNumber = 0;
  for (const thread of threads) {
    if (usedNumbers.has(thread.number)) {
      thread.number = maxNumber + 1;
    }
    usedNumbers.add(thread.number);
    maxNumber = Math.max(maxNumber, thread.number);
  }
  return threads;
};

/**
 * 读取全部评论数据，并对旧版本数据做平滑迁移：
 * - v1：{ [画布名]: 评论数组 }（无 version 字段）
 * - 更早：独立旧 key 下的扁平评论数组，归入当前画布
 */
export const loadCommentsStorage = (): CommentsStorageData => {
  let canvases: CommentsByCanvas = {};
  let migrated = false;

  try {
    const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.version === STORAGE_VERSION
      ) {
        canvases = Object.entries(parsed.canvases || {}).reduce(
          (acc, [canvas, threads]) => {
            acc[canvas] = normalizeThreads(threads);
            return acc;
          },
          {} as CommentsByCanvas,
        );
      } else if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        // v1：画布名 -> 评论数组
        canvases = Object.entries(parsed.canvases || parsed).reduce(
          (acc, [canvas, threads]) => {
            acc[canvas] = normalizeThreads(threads);
            return acc;
          },
          {} as CommentsByCanvas,
        );
        migrated = true;
      } else if (Array.isArray(parsed)) {
        // 扁平数组，归入当前画布
        canvases = {
          [getContainerNameFromStorage()]: normalizeThreads(parsed),
        };
        migrated = true;
      }
    }
  } catch (error) {
    console.error("读取评论数据失败", error);
  }

  // 迁移更早期的独立 key
  for (const legacyKey of LEGACY_COMMENTS_STORAGE_KEYS) {
    try {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (!legacyRaw) {
        continue;
      }
      const legacyParsed = JSON.parse(legacyRaw);
      const currentCanvas = getContainerNameFromStorage();
      const legacyThreads = Array.isArray(legacyParsed)
        ? normalizeThreads(legacyParsed)
        : normalizeThreads(legacyParsed?.[currentCanvas]);
      if (legacyThreads.length) {
        canvases[currentCanvas] = [
          ...(canvases[currentCanvas] || []),
          ...legacyThreads,
        ];
        migrated = true;
      }
      localStorage.removeItem(legacyKey);
    } catch (error) {
      console.error("迁移旧评论数据失败", error);
    }
  }

  const data = { version: STORAGE_VERSION, canvases };
  // 合并迁移后统一保证各画布编号唯一
  for (const canvas of Object.keys(data.canvases)) {
    data.canvases[canvas] = ensureUniqueNumbers(data.canvases[canvas]);
  }
  if (migrated) {
    saveCommentsStorage(data);
  }
  return data;
};

export const saveCommentsStorage = (data: CommentsStorageData) => {
  try {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("保存评论数据失败", error);
  }
};

export const loadCommentsForCanvas = (canvas: string): CommentThread[] => {
  return loadCommentsStorage().canvases[canvas] || [];
};

export const saveCommentsForCanvas = (
  canvas: string,
  threads: CommentThread[],
) => {
  const data = loadCommentsStorage();
  data.canvases[canvas] = threads;
  saveCommentsStorage(data);
};

/** 画布重命名时同步迁移评论数据，避免丢失 */
export const renameCommentsCanvas = (oldName: string, newName: string) => {
  if (!oldName || !newName || oldName === newName) {
    return;
  }
  const data = loadCommentsStorage();
  if (data.canvases[oldName]) {
    data.canvases[newName] = [
      ...(data.canvases[newName] || []),
      ...data.canvases[oldName],
    ];
    delete data.canvases[oldName];
    saveCommentsStorage(data);
  }
};

/** 画布删除时同步清理评论数据 */
export const removeCommentsCanvas = (canvas: string) => {
  const data = loadCommentsStorage();
  if (data.canvases[canvas]) {
    delete data.canvases[canvas];
    saveCommentsStorage(data);
  }
};
