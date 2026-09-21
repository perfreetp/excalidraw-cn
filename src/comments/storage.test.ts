import {
  getCommentsStorageKey,
  loadCommentsFromStorage,
  removeCommentsStorage,
  renameCommentsStorage,
  saveCommentsToStorage,
} from "./storage";
import { STORAGE_KEYS } from "../excalidraw-app/app_constants";
import { CommentThread } from "./types";

const makeComment = (number: number): CommentThread => ({
  id: `comment-${number}`,
  number,
  x: number,
  y: number + 10,
  elementId: null,
  offsetFx: 0,
  offsetFy: 0,
  orphaned: false,
  resolved: false,
  author: "tester",
  text: `comment ${number}`,
  replies: [],
  createdAt: 0,
  updatedAt: 0,
});

describe("comments storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads comments under the per-canvas key", () => {
    saveCommentsToStorage([makeComment(1)], "canvas-a");
    expect(
      localStorage.getItem(getCommentsStorageKey("canvas-a")),
    ).not.toBeNull();
    expect(loadCommentsFromStorage("canvas-a")).toHaveLength(1);
    expect(loadCommentsFromStorage("canvas-b")).toHaveLength(0);
  });

  it("migrates legacy global comments into the current canvas once", () => {
    localStorage.setItem(
      "excalidraw-comments",
      JSON.stringify([makeComment(1)]),
    );
    const migrated = loadCommentsFromStorage("default_canvas");
    expect(migrated).toHaveLength(1);
    expect(migrated[0].number).toBe(1);
    // 旧 key 迁移后被删除，重复加载不会再次迁移
    expect(localStorage.getItem("excalidraw-comments")).toBeNull();
    saveCommentsToStorage([makeComment(2)], "default_canvas");
    expect(loadCommentsFromStorage("default_canvas")).toHaveLength(1);
  });

  it("migrates legacy comments without duplicating existing comments", () => {
    saveCommentsToStorage([makeComment(1)], "default_canvas");
    localStorage.setItem(
      "excalidraw-comments",
      JSON.stringify([makeComment(1), makeComment(2)]),
    );
    const migrated = loadCommentsFromStorage("default_canvas");
    expect(migrated).toHaveLength(2);
    expect(migrated.map((comment) => comment.number).sort()).toEqual([1, 2]);
  });

  it("moves comments when a canvas is renamed", () => {
    saveCommentsToStorage([makeComment(1)], "old");
    renameCommentsStorage("old", "new");
    expect(localStorage.getItem(getCommentsStorageKey("old"))).toBeNull();
    expect(loadCommentsFromStorage("new")).toHaveLength(1);
  });

  it("removes comments when a canvas is removed", () => {
    saveCommentsToStorage([makeComment(1)], "to-remove");
    removeCommentsStorage("to-remove");
    expect(loadCommentsFromStorage("to-remove")).toHaveLength(0);
  });

  it("uses the configured storage prefix", () => {
    expect(getCommentsStorageKey("x")).toBe(
      `${STORAGE_KEYS.LOCAL_STORAGE_COMMENTS_PREFIX}x`,
    );
  });
});
