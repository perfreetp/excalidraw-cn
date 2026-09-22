import { nanoid } from "nanoid";
import { useSyncExternalStore } from "react";
import { ExcalidrawElement } from "../element/types";
import { getContainerNameFromStorage } from "../excalidraw-app/data/localStorage";
import { importUsernameFromLocalStorage } from "../excalidraw-app/data/localStorage";
import { t } from "../i18n";
import { loadCommentsForCanvas, saveCommentsForCanvas } from "./commentStorage";
import {
  CommentMessage,
  CommentsFilter,
  CommentThread,
  DraftComment,
} from "./types";

export interface CommentsState {
  threads: CommentThread[];
  draft: DraftComment | null;
  activeThreadId: string | null;
  highlightedThreadId: string | null;
  panelOpen: boolean;
  filter: CommentsFilter;
  /** 画布最新元素快照（用于气泡跟随定位，元素变化不一定触发 React 渲染） */
  elements: readonly ExcalidrawElement[];
}

const initialState = (): CommentsState => ({
  threads: [],
  draft: null,
  activeThreadId: null,
  highlightedThreadId: null,
  panelOpen: false,
  filter: "all",
  elements: [],
});

export const getCommentAuthor = (): string => {
  return (
    importUsernameFromLocalStorage() || t("comments.defaultAuthor") || "我"
  );
};

/** 计算评论气泡在画布场景中的实际坐标（锚定图形时跟随图形位置/缩放） */
export const getThreadPosition = (
  thread: CommentThread | DraftComment,
  elements: readonly ExcalidrawElement[],
): { x: number; y: number } => {
  if (thread.elementId) {
    const element = elements.find(
      (el) => el.id === thread.elementId && !el.isDeleted,
    );
    if (element) {
      return {
        x: element.x + thread.relX * element.width,
        y: element.y + thread.relY * element.height,
      };
    }
  }
  return { x: thread.x, y: thread.y };
};

class CommentsStore {
  private state: CommentsState = initialState();
  private listeners = new Set<() => void>();
  private canvasName = "";
  private loaded = false;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;
  private orphanListeners = new Set<(threads: CommentThread[]) => void>();

  private ensureLoaded() {
    const currentCanvas = getContainerNameFromStorage();
    if (!this.loaded || this.canvasName !== currentCanvas) {
      this.canvasName = currentCanvas;
      this.state = {
        ...initialState(),
        panelOpen: this.state.panelOpen,
        threads: loadCommentsForCanvas(currentCanvas),
      };
      this.loaded = true;
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** 订阅「评论失去锚点」事件（锚定图形被删除时触发） */
  onOrphaned = (listener: (threads: CommentThread[]) => void) => {
    this.orphanListeners.add(listener);
    return () => {
      this.orphanListeners.delete(listener);
    };
  };

  getState = (): CommentsState => {
    this.ensureLoaded();
    return this.state;
  };

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private update(partial: Partial<CommentsState>, persist = false) {
    this.state = { ...this.state, ...partial };
    if (persist) {
      saveCommentsForCanvas(this.canvasName, this.state.threads);
    }
    this.emit();
  }

  private nextNumber(): number {
    return (
      this.state.threads.reduce(
        (max, thread) => Math.max(max, thread.number),
        0,
      ) + 1
    );
  }

  startDraft(draft: DraftComment) {
    this.update({ draft, activeThreadId: null });
  }

  cancelDraft() {
    this.update({ draft: null });
  }

  commitDraft(text: string, author = getCommentAuthor()) {
    const { draft } = this.state;
    if (!draft || !text.trim()) {
      return;
    }
    const now = Date.now();
    const thread: CommentThread = {
      id: nanoid(),
      number: this.nextNumber(),
      x: draft.x,
      y: draft.y,
      elementId: draft.elementId,
      relX: draft.relX,
      relY: draft.relY,
      resolved: false,
      orphaned: false,
      messages: [
        {
          id: nanoid(),
          author,
          text: text.trim(),
          createdAt: now,
        },
      ],
      createdAt: now,
    };
    this.update(
      {
        threads: [...this.state.threads, thread],
        draft: null,
        activeThreadId: thread.id,
      },
      true,
    );
  }

  addMessage(threadId: string, text: string, author = getCommentAuthor()) {
    if (!text.trim()) {
      return;
    }
    const message: CommentMessage = {
      id: nanoid(),
      author,
      text: text.trim(),
      createdAt: Date.now(),
    };
    this.update(
      {
        threads: this.state.threads.map((thread) =>
          thread.id === threadId
            ? { ...thread, messages: [...thread.messages, message] }
            : thread,
        ),
      },
      true,
    );
  }

  editMessage(threadId: string, messageId: string, text: string) {
    if (!text.trim()) {
      return;
    }
    this.update(
      {
        threads: this.state.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: thread.messages.map((message) =>
                  message.id === messageId
                    ? { ...message, text: text.trim(), updatedAt: Date.now() }
                    : message,
                ),
              }
            : thread,
        ),
      },
      true,
    );
  }

  deleteMessage(threadId: string, messageId: string) {
    const threads = this.state.threads
      .map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              messages: thread.messages.filter(
                (message) => message.id !== messageId,
              ),
            }
          : thread,
      )
      // 最后一条评论被删除时，整个气泡一并移除
      .filter((thread) => thread.messages.length > 0);
    this.update(
      {
        threads,
        activeThreadId:
          this.state.activeThreadId &&
          threads.some((thread) => thread.id === this.state.activeThreadId)
            ? this.state.activeThreadId
            : null,
      },
      true,
    );
  }

  deleteThread(threadId: string) {
    this.update(
      {
        threads: this.state.threads.filter((thread) => thread.id !== threadId),
        activeThreadId:
          this.state.activeThreadId === threadId
            ? null
            : this.state.activeThreadId,
      },
      true,
    );
  }

  toggleResolved(threadId: string) {
    this.update(
      {
        threads: this.state.threads.map((thread) =>
          thread.id === threadId
            ? { ...thread, resolved: !thread.resolved }
            : thread,
        ),
      },
      true,
    );
  }

  setActiveThread(threadId: string | null) {
    this.update({ activeThreadId: threadId, draft: null });
  }

  highlightThread(threadId: string) {
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
    }
    this.update({ highlightedThreadId: threadId, activeThreadId: threadId });
    this.highlightTimer = setTimeout(() => {
      this.highlightTimer = null;
      this.update({ highlightedThreadId: null });
    }, 2500);
  }

  setPanelOpen(panelOpen: boolean) {
    this.update({ panelOpen });
  }

  togglePanel() {
    this.update({ panelOpen: !this.state.panelOpen });
  }

  setFilter(filter: CommentsFilter) {
    this.update({ filter });
  }

  /**
   * 与画布元素同步：锚定的图形被删除时，评论定格在最后位置并标记失去锚点。
   * 同时保存最新元素快照，驱动气泡位置跟随（元素移动不一定触发 React 渲染）。
   * 返回本次新失去锚点的评论（用于提示）。
   */
  syncElements(elements: readonly ExcalidrawElement[]): CommentThread[] {
    this.ensureLoaded();
    const newlyOrphaned: CommentThread[] = [];
    let threadsChanged = false;

    const threads = this.state.threads.map((thread) => {
      if (!thread.elementId) {
        return thread;
      }
      const element = elements.find((el) => el.id === thread.elementId);
      if (element && !element.isDeleted) {
        return thread;
      }
      // 图形已删除：定格在最后已知位置
      threadsChanged = true;
      const position = getThreadPosition(thread, elements);
      const orphanedThread: CommentThread = {
        ...thread,
        elementId: null,
        orphaned: true,
        x: position.x,
        y: position.y,
      };
      if (!thread.orphaned) {
        newlyOrphaned.push(orphanedThread);
      }
      return orphanedThread;
    });

    if (threadsChanged) {
      this.update({ threads, elements }, true);
    } else {
      this.update({ elements });
    }
    if (newlyOrphaned.length) {
      this.orphanListeners.forEach((listener) => listener(newlyOrphaned));
    }
    return newlyOrphaned;
  }
}

export const commentsStore = new CommentsStore();

export const useCommentsState = (): CommentsState =>
  useSyncExternalStore(commentsStore.subscribe, commentsStore.getState);
