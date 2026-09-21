import { NonDeletedExcalidrawElement } from "../element/types";
import { getContainerNameFromStorage } from "../excalidraw-app/data/localStorage";
import { t } from "../i18n";
import { CommentThread } from "./types";

/** 未解决评论的气泡颜色（按编号循环） */
export const COMMENT_COLORS = [
  "#e64980",
  "#f08c00",
  "#2f9e44",
  "#1971c2",
  "#9c36b5",
  "#e8590c",
  "#0c8599",
  "#c2255c",
];

export const getCommentColor = (comment: CommentThread) =>
  COMMENT_COLORS[
    (comment.number - 1 + COMMENT_COLORS.length) % COMMENT_COLORS.length
  ];

/**
 * 计算评论在场景中的位置。
 * 锚定图形时根据图形当前位置与尺寸（比例偏移）实时计算，
 * 从而跟随图形移动与缩放；否则返回评论自身记录的位置。
 */
export const getCommentScenePosition = (
  comment: CommentThread,
  elementsMap: Map<string, NonDeletedExcalidrawElement>,
): { x: number; y: number } | null => {
  if (comment.elementId && !comment.orphaned) {
    const element = elementsMap.get(comment.elementId);
    if (!element) {
      return null;
    }
    return {
      x: element.x + comment.offsetFx * element.width,
      y: element.y + comment.offsetFy * element.height,
    };
  }
  return { x: comment.x, y: comment.y };
};

const formatTime = (timestamp: number) => {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** 生成当前画布评论的文本清单 */
export const exportCommentsAsText = (comments: CommentThread[]) => {
  const containerName = getContainerNameFromStorage();
  const lines: string[] = [
    t("comments.exportTitle", { name: containerName }),
    t("comments.exportTime", { time: formatTime(Date.now()) }),
    "",
  ];

  const sorted = [...comments].sort((a, b) => a.number - b.number);
  if (!sorted.length) {
    lines.push(t("comments.exportEmpty"));
  }

  sorted.forEach((comment) => {
    const status = comment.resolved
      ? t("comments.statusResolved")
      : t("comments.statusOpen");
    const anchor = comment.elementId
      ? t("comments.anchorElement")
      : comment.orphaned
      ? t("comments.anchorOrphaned")
      : t("comments.anchorCanvas");
    lines.push(`#${comment.number} [${status}] (${anchor})`);
    lines.push(
      `  ${comment.author || t("comments.anonymous")} ${formatTime(
        comment.createdAt,
      )}: ${comment.text}`,
    );
    comment.replies.forEach((reply) => {
      lines.push(
        `  ↳ ${reply.author || t("comments.anonymous")} ${formatTime(
          reply.createdAt,
        )}: ${reply.text}`,
      );
    });
    lines.push("");
  });

  return lines.join("\n");
};

export const downloadCommentsText = (comments: CommentThread[]) => {
  const text = exportCommentsAsText(comments);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `comments-${getContainerNameFromStorage()}-${date}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export { formatTime };
