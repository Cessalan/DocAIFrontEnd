import React, { Suspense, lazy, useMemo } from 'react';
import { parseAsciiConceptMap, looksLikeDiagram } from './asciiConceptMap';

// Carries reactflow and the PDF stack. Only fetched once a message actually
// turns out to contain a diagram.
const ConceptMapBlock = lazy(() => import('./ConceptMapBlock'));

/** Flatten whatever react-markdown handed us for a fence into its raw text. */
export const fenceText = (children) =>
  React.Children.toArray(children)
    .map((child) => (typeof child === 'string' ? child : child?.props?.children ?? ''))
    .flat()
    .map((value) => (typeof value === 'string' ? value : ''))
    .join('');

/**
 * DiagramAwarePre — a react-markdown `pre` replacement.
 *
 * Fenced code blocks in a tutor answer are hardly ever code. They are the
 * ASCII concept maps and pathophysiology flows students ask for, and as a code
 * block they land as unreadable monospace. When one parses as a diagram, draw
 * it instead: a real graph they can pan, open, and export to PDF for the
 * assignment.
 *
 * Replacing `pre` rather than `code` is what keeps inline `code` untouched.
 * Anything that does not parse cleanly falls straight back to the code block.
 */
function DiagramAwarePre({ children, ...props }) {
  const codeElement = React.Children.toArray(children)[0];
  const source = fenceText(codeElement?.props?.children);
  const className = codeElement?.props?.className || '';
  const language = /language-([\w-]+)/.exec(className)?.[1] || '';

  const conceptMap = useMemo(() => {
    if (!looksLikeDiagram(source, language)) return null;
    return parseAsciiConceptMap(source, { language });
  }, [source, language]);

  const plainBlock = <pre {...props}>{children}</pre>;

  if (!conceptMap) return plainBlock;

  return (
    <Suspense fallback={plainBlock}>
      <ConceptMapBlock data={conceptMap} source={source} />
    </Suspense>
  );
}

export default DiagramAwarePre;
