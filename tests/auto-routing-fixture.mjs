export function fanoutProject() {
  const positions = [
    [-1458.1275688478777, 2069.4251012993386],
    [435, -55],
    [407, 255.5],
    [397, 462.5],
    [392, 717.5],
    [386, 957.5],
    [379, 1188.5],
  ];
  const cards = positions.map(([x, y], i) => ({
    id: 'fan-' + i,
    title: i ? 'Note ' + i : 'Inbox',
    summary: 'Automatic routing example',
    position: { x, y },
    size: { width: 260, height: 190 },
  }));
  const mind = [
    [0, 0],
    [380, 0],
    [419, 110.5],
    [419, 110.5],
    [536, 464.5],
    [536, 464.5],
    [571, 795.5],
  ];
  return {
    version: '1.0',
    metadata: { title: 'User fanout routing case' },
    cards,
    relations: cards.slice(1).map((c, i) => ({
      id: 'wire-' + i,
      source: cards[0].id,
      target: c.id,
      label: '',
      extensions: { 'card-atlas:edge': { route: 'orthogonal' } },
    })),
    extensions: {
      'card-atlas:views': {
        mindMap: {
          positions: Object.fromEntries(
            cards.map((c, i) => [c.id, { x: mind[i][0], y: mind[i][1] }]),
          ),
        },
      },
    },
  };
}
export const rectangles = (p) =>
  new Map(p.cards.map((c) => [c.id, { id: c.id, ...c.position, ...c.size }]));
