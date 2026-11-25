export interface Point {
  x: number;
  y: number;
}
export interface GroupLink {
  id: string;
  /** Card the arrow starts from; the arrow ends at the group frame. */
  source: string;
}
export interface CardGroup {
  id: string;
  title: string;
  cardIds: string[];
  /** Enclosing group; groups nest up to three levels. cardIds may be empty when subgroups exist. */
  parentId?: string;
  /** Short text shown under the title on the frame (max 500 characters). */
  description?: string;
  links?: GroupLink[];
}
export interface ProjectGroups {
  groups: CardGroup[];
}
export interface EdgeRouting {
  modes?: Partial<Record<'card' | 'mind', 'auto' | 'manual'>>;
  route: 'curved' | 'straight' | 'orthogonal' | 'zigzag';
  adjustments?: { card?: number; mind?: number };
  corners?: Partial<
    Record<'card' | 'mind', { axis: 'horizontal' | 'vertical'; source: Point; target: Point }>
  >;
}
export interface Card {
  id: string;
  title: string;
  summary: string;
  type: string;
  tags: string[];
  content: string;
  position: Point;
  size: { width: number; height: number };
  style: { backgroundColor: string; textColor: string; borderColor: string };
  extensions?: Record<string, unknown>;
}
export interface Relation {
  id: string;
  source: string;
  target: string;
  label: string;
  description: string;
  type: string;
  style: {
    color: string;
    line: 'solid' | 'dashed' | 'dotted';
    arrow: 'none' | 'start' | 'end' | 'both';
  };
  extensions?: Record<string, unknown>;
}
export interface Project {
  version: '1.0';
  metadata: { title: string; description: string };
  canvas: { zoom: number; position: Point };
  cards: Card[];
  relations: Relation[];
  extensions?: Record<string, unknown>;
}
export type Selection = { kind: 'card' | 'relation'; id: string } | null;

export interface NodePresentation {
  kind: 'card' | 'text' | 'image' | 'image-text';
  coverImageId?: string;
  imageFit?: 'contain' | 'cover';
  imageAlt?: string;
}
export interface MindMapView {
  positions?: Record<string, Point>;
  sizes?: Record<string, { width: number; height: number }>;
  viewport?: { zoom: number; position: Point };
}
export interface MindMapConfig {
  rootId?: string;
  boardRoots?: Record<string, string>;
}
export interface MindMapRelation {
  kind: 'branch' | 'reference';
  color?: string;
}

export interface NodeAppearance {
  shape?:
    | 'rectangle'
    | 'rounded'
    | 'square'
    | 'circle'
    | 'ellipse'
    | 'diamond'
    | 'triangle'
    | 'hexagon'
    | 'star'
    | 'heart'
    | 'octagon'
    | 'arrow'
    | 'isosceles-triangle'
    | 'right-triangle';
  sizeMode?: 'manual' | 'fit';
  titleFontSize?: number; // 12–72px
  radius?: number;
  borderWidth?: number;
  align?: 'left' | 'center' | 'right';
  shadow?: 'none' | 'soft';
  backgroundTransparent?: boolean;
  borderTransparent?: boolean;
}

export interface CardMetadata {
  createdDate?: string;
  pinned?: boolean;
  createdAt?: string;
}

export type CardStatusValue = 'new' | 'in-progress' | 'done' | 'blocked' | 'cancelled';

export interface CardStatus {
  value: CardStatusValue;
}

export interface CardSchedule {
  start: string;
  end?: string;
}

export interface CardOwner {
  nodeId: string;
}

export interface TimelineConfig {
  version: 1;
  title?: string;
  description?: string;
}

export interface CardComment {
  id: string;
  createdAt: string;
  text: string;
}

export interface CardComments {
  version: 1;
  items: CardComment[];
}

export interface CardTextStyle {
  fontSize?: number;
  color?: string;
  fontFamily?: 'system' | 'serif' | 'mono';
}
export type CardTypography = Partial<Record<'title' | 'summary' | 'type', CardTextStyle>>;
