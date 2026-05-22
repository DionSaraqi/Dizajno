/**
 * Grabs the current WebGL canvas, downscales it, and returns a PNG Blob suited
 * for project thumbnails. Returns null if no canvas is mounted, the canvas
 * isn't readable (R3F renders without preserveDrawingBuffer by default — the
 * /projects/[id] route opts in), or the browser can't produce a Blob.
 */
export async function captureCanvasThumbnail(
  maxWidth = 800,
  maxHeight = 600
): Promise<Blob | null> {
  // The R3F Canvas is the only <canvas> on the designer route; on /projects/[id]
  // there's exactly one.
  const source = document.querySelector("canvas");
  if (!source) return null;
  const srcW = source.width;
  const srcH = source.height;
  if (srcW <= 0 || srcH <= 0) return null;

  const ratio = Math.min(maxWidth / srcW, maxHeight / srcH, 1);
  const destW = Math.max(1, Math.round(srcW * ratio));
  const destH = Math.max(1, Math.round(srcH * ratio));

  const off = document.createElement("canvas");
  off.width = destW;
  off.height = destH;
  const ctx = off.getContext("2d");
  if (!ctx) return null;

  try {
    ctx.drawImage(source, 0, 0, destW, destH);
  } catch {
    // SecurityError when the source canvas is tainted (cross-origin textures
    // without proper CORS). Bail rather than throw.
    return null;
  }

  return new Promise((resolve) => {
    off.toBlob((blob) => resolve(blob), "image/png");
  });
}
