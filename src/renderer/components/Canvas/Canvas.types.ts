export type CanvasCardType = 'note' | 'text' | 'image' | 'group';

export interface CanvasNode {
  id: string;
  type: CanvasCardType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string; // noteId for 'note', markdown for 'text', url for 'image' (unused now), label for 'group'
  color?: string; // for groups
  imageBase64?: string; // base64 string for images
  imageType?: string; // mime type for images
}

export interface CanvasEdge {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}
