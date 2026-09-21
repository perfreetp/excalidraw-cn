import { jotaiStore } from "../jotai";
import {
  activeCommentIdAtom,
  addReply,
  commentsAtom,
  commitDraftComment,
  deleteComment,
  draftCommentAtom,
  markCommentOrphaned,
  openDraftComment,
  toggleCommentResolved,
} from "./store";

const getComments = () => jotaiStore.get(commentsAtom) ?? [];

describe("comments store", () => {
  beforeEach(() => {
    localStorage.clear();
    jotaiStore.set(commentsAtom, []);
    jotaiStore.set(draftCommentAtom, null);
    jotaiStore.set(activeCommentIdAtom, null);
  });

  it("creates numbered comments from a draft", () => {
    openDraftComment({
      x: 10,
      y: 20,
      elementId: null,
      offsetFx: 0,
      offsetFy: 0,
    });
    commitDraftComment("first comment");
    commitDraftComment("  "); // 空内容不会创建

    openDraftComment({
      x: 30,
      y: 40,
      elementId: "el-1",
      offsetFx: 0.5,
      offsetFy: 0.25,
    });
    commitDraftComment("second comment");

    const comments = getComments();
    expect(comments).toHaveLength(2);
    expect(comments.map((comment) => comment.number)).toEqual([1, 2]);
    expect(comments[1].elementId).toBe("el-1");
    expect(jotaiStore.get(draftCommentAtom)).toBeNull();
  });

  it("supports replies, resolving and deletion", () => {
    openDraftComment({ x: 0, y: 0, elementId: null, offsetFx: 0, offsetFy: 0 });
    commitDraftComment("hello");
    const id = getComments()[0].id;

    addReply(id, "a reply");
    addReply(id, "   ");
    expect(getComments()[0].replies).toHaveLength(1);

    toggleCommentResolved(id);
    expect(getComments()[0].resolved).toBe(true);
    toggleCommentResolved(id);
    expect(getComments()[0].resolved).toBe(false);

    deleteComment(id);
    expect(getComments()).toHaveLength(0);
    expect(jotaiStore.get(activeCommentIdAtom)).toBeNull();
  });

  it("marks orphaned comments at their last position and clears the anchor", () => {
    openDraftComment({
      x: 100,
      y: 200,
      elementId: "el-1",
      offsetFx: 0,
      offsetFy: 0,
    });
    commitDraftComment("anchored");
    const id = getComments()[0].id;

    markCommentOrphaned(id, 150, 250);
    const comment = getComments()[0];
    expect(comment.orphaned).toBe(true);
    expect(comment.elementId).toBeNull();
    expect(comment.x).toBe(150);
    expect(comment.y).toBe(250);
  });

  it("persists comments to the per-canvas localStorage key", () => {
    openDraftComment({ x: 0, y: 0, elementId: null, offsetFx: 0, offsetFy: 0 });
    commitDraftComment("persisted");
    const raw = localStorage.getItem("excalidraw-comments:default_canvas");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toHaveLength(1);
  });
});
