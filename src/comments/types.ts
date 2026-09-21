export interface CommentReply {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

export interface CommentThread {
  id: string;
  /** 画布内递增编号，用于气泡序号展示 */
  number: number;
  /** 场景坐标（锚定图形时为最近一次已知位置，失去锚点后为固定位置） */
  x: number;
  y: number;
  /** 锚定的图形 id，null 表示钉在画布空白处 */
  elementId: string | null;
  /** 相对图形宽高的比例偏移，图形移动/缩放时用于跟随 */
  offsetFx: number;
  offsetFy: number;
  /** 锚定图形已被删除，评论失去锚点 */
  orphaned: boolean;
  resolved: boolean;
  author: string;
  text: string;
  replies: CommentReply[];
  createdAt: number;
  updatedAt: number;
}

export type CommentFilter = "all" | "open" | "resolved";

export interface DraftComment {
  x: number;
  y: number;
  elementId: string | null;
  offsetFx: number;
  offsetFy: number;
}
