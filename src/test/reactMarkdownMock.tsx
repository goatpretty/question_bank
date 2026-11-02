import type { ReactNode } from 'react';

/** Jest 环境下的 react-markdown 替身：仅渲染原始文本。 */
export default function ReactMarkdown({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
