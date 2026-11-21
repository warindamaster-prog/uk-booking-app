import { Fragment, type ReactNode } from "react";
import type { T } from "./core";

/**
 * A translated sentence with links or other elements inside it: `rich(t, "Add a card {link} now", { link: <a>..</a> })`.
 * The sentence is translated as a whole, so word order can differ between languages.
 */
export function rich(t: T, key: string, parts: Record<string, ReactNode>): ReactNode {
  const text = t(key);
  return text.split(/(\{\w+\})/g).map((piece, i) => {
    const m = /^\{(\w+)\}$/.exec(piece);
    return <Fragment key={i}>{m && m[1] in parts ? parts[m[1]] : piece}</Fragment>;
  });
}
