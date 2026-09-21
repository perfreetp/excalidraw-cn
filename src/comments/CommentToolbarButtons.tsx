import "../components/ToolIcon.scss";

import clsx from "clsx";
import { useAtom } from "jotai";
import { t } from "../i18n";
import { jotaiScope } from "../jotai";
import { CommentIcon, CommentsListIcon } from "../components/icons";
import { commentModeAtom, commentPanelOpenAtom } from "./store";

const ToggleButton = ({
  title,
  checked,
  onChange,
  icon,
  dataTestId,
}: {
  title: string;
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  dataTestId?: string;
}) => (
  <label
    className={clsx("ToolIcon", "ToolIcon_size_medium")}
    title={title}
    data-testid={dataTestId}
  >
    <input
      className="ToolIcon_type_checkbox"
      type="checkbox"
      onChange={onChange}
      checked={checked}
      aria-label={title}
    />
    <div className="ToolIcon__icon">{icon}</div>
  </label>
);

/** 批注模式开关：开启后点击画布任意位置即可添加评论 */
export const CommentModeButton = () => {
  const [commentMode, setCommentMode] = useAtom(commentModeAtom, jotaiScope);
  return (
    <ToggleButton
      title={t("toolBar.commentMode")}
      checked={commentMode}
      onChange={() => setCommentMode(!commentMode)}
      icon={CommentIcon}
      dataTestId="comment-mode-button"
    />
  );
};

/** 左侧评论列表面板开关 */
export const CommentPanelButton = () => {
  const [open, setOpen] = useAtom(commentPanelOpenAtom, jotaiScope);
  return (
    <ToggleButton
      title={t("toolBar.commentList")}
      checked={open}
      onChange={() => setOpen(!open)}
      icon={CommentsListIcon}
      dataTestId="comment-panel-button"
    />
  );
};
