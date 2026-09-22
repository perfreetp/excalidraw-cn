export interface CommentMessage {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  updatedAt?: number;
}

export interface CommentThread {
  id: string;
  /** 画布内自增编号，用于气泡序号展示 */
  number: number;
  /** 画布场景坐标（未锚定图形时生效） */
  x: number;
  y: number;
  /** 钉住的图形 id，为 null 表示位于画布空白处 */
  elementId: string | null;
  /** 相对图形左上角的比例位置（0~1），图形移动/缩放时用于跟随 */
  relX: number;
  relY: number;
  resolved: boolean;
  /** 锚定图形已被删除，评论失去锚点 */
  orphaned: boolean;
  messages: CommentMessage[];
  createdAt: number;
}

export interface DraftComment {
  x: number;
  y: number;
  elementId: string | null;
  relX: number;
  relY: number;
}

export type CommentsFilter = "all" | "unresolved" | "resolved";

export type CommentsByCanvas = Record<string, CommentThread[]>;
