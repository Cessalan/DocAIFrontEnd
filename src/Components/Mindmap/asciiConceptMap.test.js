import { parseAsciiConceptMap, looksLikeDiagram } from './asciiConceptMap';

/**
 * Every diagram below is copied verbatim out of the sickle-cell conversation
 * (chat 7rSDeIW6cqKehIzIFmFR) where the student kept asking for a concept map
 * and kept getting monospace ASCII back.
 */

const labels = (map) => map.nodes.map((n) => n.label);
const byLabel = (map, label) => map.nodes.find((n) => n.label === label);
const parentOf = (map, label) => {
  const node = byLabel(map, label);
  if (!node || !node.parent) return null;
  return map.nodes.find((n) => n.id === node.parent)?.label ?? null;
};

describe('parseAsciiConceptMap — real transcript diagrams', () => {
  test('pipe-and-dash hierarchy becomes a rooted tree', () => {
    const map = parseAsciiConceptMap(`
                    [Sickle Cell Anemia]
                              |
   ----------------------------------------------------------------------
   |               |                 |           |         |         |
[Definition]  [Etiology & RF] [Pathophysiology] [S/Sx] [Diagnostics] [Complications]
                              |
                        [Management]
                              |
           ----------------------------------
           |              |              |
   [Medical/Surgical] [Pharmacology] [Nursing Mgmt]
`);

    expect(map).not.toBeNull();
    expect(map.central_topic).toBe('Sickle Cell Anemia');
    expect(byLabel(map, 'Sickle Cell Anemia').type).toBe('central');
    expect(parentOf(map, 'Definition')).toBe('Sickle Cell Anemia');
    expect(parentOf(map, 'Complications')).toBe('Sickle Cell Anemia');
    expect(parentOf(map, 'Medical/Surgical')).toBe('Management');
    expect(parentOf(map, 'Nursing Mgmt')).toBe('Management');
    // The pipe above [Management] sits in Pathophysiology's column, so that is
    // where the branch hangs — one level deeper than the top-row categories.
    expect(parentOf(map, 'Management')).toBe('Pathophysiology');
    expect(byLabel(map, 'Management').type).toBe('sub');
    expect(byLabel(map, 'Medical/Surgical').type).toBe('detail');
  });

  test('the screenshot diagram — management branch nests under the root', () => {
    const map = parseAsciiConceptMap(`
          [SICKLE CELL ANEMIA]
                    |
           ----------------------
           |                    |
      [Pathophysiology]     [Management]
                                  |
            -------------------------------------
            |             |                   |
 [Medical/Surgical] [Pharmacologic] [Nursing Management]
`);

    expect(map).not.toBeNull();
    expect(map.central_topic).toBe('SICKLE CELL ANEMIA');
    expect(parentOf(map, 'Pathophysiology')).toBe('SICKLE CELL ANEMIA');
    expect(parentOf(map, 'Management')).toBe('SICKLE CELL ANEMIA');
    expect(parentOf(map, 'Pharmacologic')).toBe('Management');
    expect(map.nodes).toHaveLength(6);
  });

  test('slash-branch layout with an inline pathophysiology flow', () => {
    const map = parseAsciiConceptMap(`
                    [Sickle Cell Anemia]
                             /     |     \\
             [Definition]  [Etiology & RF]  [Pathophysiology]
                                                |
                  Mutation → HbS → Sickling → Vaso-occlusion → Pain/Anemia
`);

    expect(map).not.toBeNull();
    expect(parentOf(map, 'Definition')).toBe('Sickle Cell Anemia');
    // The flow hangs off the section it was drawn under and stays a chain.
    expect(parentOf(map, 'Mutation')).toBe('Pathophysiology');
    expect(parentOf(map, 'HbS')).toBe('Mutation');
    expect(parentOf(map, 'Sickling')).toBe('HbS');
    expect(parentOf(map, 'Pain/Anemia')).toBe('Vaso-occlusion');
  });

  test('the "finalized visual layout" — repeated headings merge, bullets become details', () => {
    const map = parseAsciiConceptMap(`
                                    [SICKLE CELL ANEMIA]
                                             |
     ----------------------------------------------------------------
     |               |                |                  |          |
[Definition]  [Etiology & RF]  [Pathophysiology]  [Diagnostics] [Management]

[Definition]
- Inherited blood disorder
- Abnormal hemoglobin S causes RBC sickling

[Etiology & RF]
- β-globin gene mutation (autosomal recessive)
- Family history

[Pathophysiology]
- β-globin gene mutation
      ↓
- HbS produced
      ↓
- RBCs sickle (low O₂, dehydration, infection)
      ↓
- Vaso-occlusion (blockage of vessels)

[Management]
      |
   ------------------------------------------------------------
   |                          |                             |
[Medical/Surgical]      [Pharmacologic]           [Nursing Management]

[Medical/Surgical]
- Blood transfusions
- Oxygen therapy

[Pharmacologic]
- Hydroxyurea
- Folic acid
`);

    expect(map).not.toBeNull();

    // A heading that appears twice is one concept, not two boxes.
    expect(labels(map).filter((l) => l === 'Definition')).toHaveLength(1);
    expect(labels(map).filter((l) => l === 'Management')).toHaveLength(1);

    // Bullets ride along as details on their section.
    expect(byLabel(map, 'Definition').details).toEqual([
      'Inherited blood disorder',
      'Abnormal hemoglobin S causes RBC sickling'
    ]);
    expect(byLabel(map, 'Pharmacologic').details).toEqual(['Hydroxyurea', 'Folic acid']);

    // The management sub-branch still attaches to Management, not to the last
    // bullet section that happened to precede it.
    expect(parentOf(map, 'Medical/Surgical')).toBe('Management');
    expect(parentOf(map, 'Nursing Management')).toBe('Management');

    // Bullets separated by ↓ are a flow, so they become chained nodes.
    expect(parentOf(map, 'β-globin gene mutation')).toBe('Pathophysiology');
    expect(parentOf(map, 'HbS produced')).toBe('β-globin gene mutation');
    expect(parentOf(map, 'Vaso-occlusion (blockage of vessels)')).toBe(
      'RBCs sickle (low O₂, dehydration, infection)'
    );
    expect(byLabel(map, 'Pathophysiology').details).toEqual([]);
  });

  test('bare rows under a connector are read as boxes', () => {
    const map = parseAsciiConceptMap(`
                    [SICKLE CELL ANEMIA]
   /      |         |          |         |         |         |
Def  Etiol  Patho  S/Sx  Dx/Lab  Med/Surg  Pharm  Nursing  Complic
`);

    expect(map).not.toBeNull();
    expect(parentOf(map, 'Def')).toBe('SICKLE CELL ANEMIA');
    expect(parentOf(map, 'Complic')).toBe('SICKLE CELL ANEMIA');
    expect(map.nodes).toHaveLength(10);
  });

  test('every node carries a depth-derived type and one root exists', () => {
    const map = parseAsciiConceptMap(`
[Root]
   |
[Branch A]  [Branch B]
   |
[Leaf]
`);

    expect(map).not.toBeNull();
    expect(map.nodes.filter((n) => !n.parent)).toHaveLength(1);
    expect(map.nodes.every((n) => ['central', 'main', 'sub', 'detail'].includes(n.type))).toBe(true);
  });

  test('children arrays and edges agree', () => {
    const map = parseAsciiConceptMap(`
          [SICKLE CELL ANEMIA]
                    |
      [Pathophysiology]     [Management]
`);

    const root = byLabel(map, 'SICKLE CELL ANEMIA');
    expect(root.children).toHaveLength(2);
    map.edges.forEach((edge) => {
      expect(map.nodes.some((n) => n.id === edge.source)).toBe(true);
      expect(map.nodes.some((n) => n.id === edge.target)).toBe(true);
    });
  });
});

describe('parseAsciiConceptMap — refuses what it should not draw', () => {
  test('real code is left alone', () => {
    expect(
      parseAsciiConceptMap(`const nodes = [1, 2, 3];
function build(map) {
  return map.nodes.filter(n => n.parent);
}`)
    ).toBeNull();
  });

  test('a tagged code fence is never a diagram', () => {
    const diagram = `
[Root]
   |
[A]  [B]
   |
[C]
`;
    expect(parseAsciiConceptMap(diagram, { language: 'python' })).toBeNull();
    expect(parseAsciiConceptMap(diagram)).not.toBeNull();
  });

  test('prose in a fence stays prose', () => {
    expect(
      parseAsciiConceptMap(`Remember to hydrate the patient regularly.
Monitor for signs of infection during every shift.
Escalate to the provider if the pain score stays above seven.`)
    ).toBeNull();
  });

  test('too small to be worth drawing', () => {
    expect(parseAsciiConceptMap('[Sickle Cell Anemia]')).toBeNull();
    expect(parseAsciiConceptMap('')).toBeNull();
    expect(parseAsciiConceptMap(null)).toBeNull();
  });

  test('a cycle in the source cannot produce a cycle in the tree', () => {
    const map = parseAsciiConceptMap(`
[Start]
   |
Start → Middle → End → Start
`);
    if (map) {
      expect(map.nodes.filter((n) => !n.parent)).toHaveLength(1);
      // Walking children from the root must terminate.
      const seen = new Set();
      const stack = [map.nodes.find((n) => !n.parent).id];
      while (stack.length) {
        const id = stack.pop();
        expect(seen.has(id)).toBe(false);
        seen.add(id);
        const node = map.nodes.find((n) => n.id === id);
        node.children.forEach((c) => stack.push(c));
      }
    }
  });
});

describe('looksLikeDiagram', () => {
  test('accepts sketches, rejects code and prose', () => {
    expect(looksLikeDiagram('[A]\n |\n[B]  [C]')).toBe(true);
    expect(looksLikeDiagram('Gene → HbS → Sickling\nMutation → Pain')).toBe(true);
    expect(looksLikeDiagram('just a sentence')).toBe(false);
    expect(looksLikeDiagram('[A]\n |\n[B]', 'json')).toBe(false);
  });
});
