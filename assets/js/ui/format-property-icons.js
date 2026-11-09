// Decorative icons: native labels and controls remain the accessible interface.
const paths = {
  displaySettings: 'M4 4h16v16H4zM8 8h8v8H8z',
  imageSettings: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 5M16 8h.01',
  sizeSettings: 'M4 4h16v16H4zM8 16l8-8M12 8h4v4',
  surfaceSettings:
    'M12 3a9 9 0 1 0 9 9c0-2-1-3-3-3h-2a2 2 0 0 1-2-2V6c0-2-1-3-2-3zM7 11h.01M10 7h.01M7 15h.01',
  inspectorRoutingGroup: 'M3 18h5V7h8M13 4l3 3-3 3M16 7h5',
  inspectorLineGroup: 'M3 12h18M17 8l4 4-4 4',
  inspectorEndpointsGroup: 'M4 12h16M4 9v6M20 9v6',
  inspectorInformationGroup: 'M12 10v6M12 7h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  cards: 'M4 4h16v16H4zM7 8h10M7 12h7',
  arrows: 'M3 12h18M17 8l4 4-4 4',
  routes: 'M3 18h5V7h8M13 4l3 3-3 3M16 7h5',
  align: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  shadow: 'M4 4h13v13H4zM8 20h10a2 2 0 0 0 2-2V8',
  line: 'M3 12h18',
  arrow: 'M3 12h18M17 8l4 4-4 4',
  edgeRoute: 'M3 18h5V7h8M13 4l3 3-3 3M16 7h5',
  source: 'M4 12h16M4 9v6M8 8l-4 4 4 4',
  target: 'M4 12h16M20 9v6M16 8l4 4-4 4',
  cardShape: 'M4 4h9l7 7v9H4zM13 4v7h7',
  nodeKind: 'M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z',
  backgroundColor: 'M4 4h16v16H4zM7 15h10v2H7z',
  borderColor: 'M4 4h16v16H4zM8 8h8v8H8z',
  width: 'M3 5v14M21 5v14M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4',
  height: 'M5 3h14M5 21h14M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4',
  radius: 'M5 20v-8a7 7 0 0 1 7-7h8M5 20h15V5',
  borderWidth: 'M4 4h16v16H4zM8 8h8v8H8zM11 4v4',
  fontSize: 'M3 18 8 5l5 13M5 13h6M15 18l3-8 3 8M16 15h4',
  fontFamily: 'M4 5V3h16v2M12 3v18M8 21h8',
  textColor: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M12 7h3M12 12h5M12 17h3',
  resetTextStyle: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5',
  sizeMode: 'M4 4h16v16H4zM8 12h8M12 8v8',
  edgeMode: 'M4 18h6V6h10M16 3l4 3-4 3',
  relationKind: 'M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4',
  overviewField: 'M4 5h16M4 12h10M4 19h16',
  overviewText: 'M4 5h16M4 10h16M4 15h12M4 20h8',
  tags: 'M3 5v6l8 8 8-8-8-8H5a2 2 0 0 0-2 2zM7 7h.01',
  typography: 'M4 5V3h16v2M12 3v18M8 21h8',
  image: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 5',
  color: 'M12 3a9 9 0 1 0 9 9c0-2-1-3-3-3h-2a2 2 0 0 1-2-2V6c0-2-1-3-2-3z',
  size: 'M4 4h16v16H4zM8 16l8-8M12 8h4v4',
  default: 'M4 17l-1 4 4-1L19 8l-3-3L4 17zM14 7l3 3',
};
const category = (key) => {
  if (/color|background|border|surface/i.test(key)) return 'color';
  if (/image|cover/i.test(key)) return 'image';
  if (/size|width|height|radius/i.test(key)) return 'size';
  if (/font|text|title|typography/i.test(key)) return 'typography';
  return 'default';
};
export function formatPropertyIcon(key) {
  const path = paths[key] || paths[category(key)];
  return (
    '<svg class="format-property-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' +
    path +
    '"></path></svg>'
  );
}
