import React from 'react';
import { render, screen } from '@testing-library/react';
import DiagramAwarePre, { fenceText } from './DiagramAwarePre';

// The real block pulls in reactflow and the PDF stack; what matters here is
// that a fence is recognised as a diagram and handed over intact.
jest.mock('./ConceptMapBlock', () => ({
  __esModule: true,
  default: ({ data, source }) => (
    <div data-testid="concept-map" data-source={source}>
      {data.central_topic} — {data.nodes.length} nodes
    </div>
  )
}));

/** What react-markdown passes to a `pre` override for a fenced block. */
const fence = (source, language) => (
  <DiagramAwarePre>
    <code className={language ? `language-${language}` : undefined}>{source}</code>
  </DiagramAwarePre>
);

const CONCEPT_MAP = `
          [SICKLE CELL ANEMIA]
                    |
           ----------------------
           |                    |
      [Pathophysiology]     [Management]
                                  |
            -------------------------------------
            |             |                   |
 [Medical/Surgical] [Pharmacologic] [Nursing Management]
`;

describe('DiagramAwarePre', () => {
  test('a fenced concept map is drawn instead of printed', async () => {
    const { container } = render(fence(CONCEPT_MAP));

    const map = await screen.findByTestId('concept-map');
    expect(map).toHaveTextContent('SICKLE CELL ANEMIA — 6 nodes');
    expect(container.querySelector('pre')).toBeNull();
  });

  test('the original sketch is passed through for the text view', async () => {
    render(fence(CONCEPT_MAP));

    const map = await screen.findByTestId('concept-map');
    expect(map.getAttribute('data-source')).toContain('[SICKLE CELL ANEMIA]');
    expect(map.getAttribute('data-source')).toContain('[Nursing Management]');
  });

  test('a tagged code fence stays a code block', () => {
    const { container } = render(fence('{ "nodes": [1, 2, 3] }', 'json'));

    expect(screen.queryByTestId('concept-map')).toBeNull();
    expect(container.querySelector('pre')).toBeTruthy();
  });

  test('prose in a fence stays a code block', () => {
    const { container } = render(
      fence('Monitor for infection every shift.\nEscalate if pain stays high.')
    );

    expect(screen.queryByTestId('concept-map')).toBeNull();
    expect(container.querySelector('pre')).toBeTruthy();
  });

  test('source code stays a code block', () => {
    const { container } = render(
      fence('const map = buildMap(nodes);\nfunction draw(map) {\n  return map;\n}')
    );

    expect(screen.queryByTestId('concept-map')).toBeNull();
    expect(container.querySelector('pre')).toBeTruthy();
  });

  test('an empty fence does not blow up', () => {
    const { container } = render(<DiagramAwarePre>{null}</DiagramAwarePre>);
    expect(container.querySelector('pre')).toBeTruthy();
  });
});

describe('fenceText', () => {
  test('flattens the shapes react-markdown produces', () => {
    expect(fenceText('plain string')).toBe('plain string');
    expect(fenceText(['two ', 'parts'])).toBe('two parts');
    expect(fenceText(undefined)).toBe('');
  });
});
