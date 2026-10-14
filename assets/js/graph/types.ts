export interface Point {
  x: number;
  y: number;
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
