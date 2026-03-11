export interface FurnitureDef {
  type: string;
  label: string;
  width: number;
  depth: number;
  height: number;
  color: string;
  icon: string; // emoji for sidebar
}

export const furnitureCatalog: FurnitureDef[] = [
  { type: "bed",       label: "Bed",       width: 2.0, depth: 1.6, height: 0.5, color: "#8B4513", icon: "🛏️" },
  { type: "table",     label: "Table",     width: 1.2, depth: 0.8, height: 0.75, color: "#A0522D", icon: "🪑" },
  { type: "chair",     label: "Chair",     width: 0.5, depth: 0.5, height: 0.9, color: "#6B4226", icon: "💺" },
  { type: "sofa",      label: "Sofa",      width: 2.0, depth: 0.9, height: 0.8, color: "#4A6670", icon: "🛋️" },
  { type: "wardrobe",  label: "Wardrobe",  width: 1.5, depth: 0.6, height: 2.0, color: "#5C4033", icon: "🗄️" },
  { type: "desk",      label: "Desk",      width: 1.4, depth: 0.7, height: 0.75, color: "#DEB887", icon: "🖥️" },
  { type: "bookshelf", label: "Bookshelf", width: 1.0, depth: 0.35, height: 1.8, color: "#8B6914", icon: "📚" },
  { type: "nightstand",label: "Nightstand",width: 0.5, depth: 0.4, height: 0.55, color: "#A0522D", icon: "🔲" },
];

export function getFurnitureDef(type: string): FurnitureDef | undefined {
  return furnitureCatalog.find((f) => f.type === type);
}
