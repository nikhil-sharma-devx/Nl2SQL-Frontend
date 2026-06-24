declare module 'react-syntax-highlighter/dist/esm/prism-light' {
  import { ComponentType } from 'react';
  const SyntaxHighlighter: ComponentType<any> & { registerLanguage: (name: string, fn: any) => void };
  export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/sql' {
  const sql: any;
  export default sql;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  import { CSSProperties } from 'react';
  type Style = { [token: string]: CSSProperties };
  export const atomDark: Style;
  export const dracula: Style;
  export const vscDarkPlus: Style;
  export const oneDark: Style;
  export const tomorrow: Style;
  export const prism: Style;
}
