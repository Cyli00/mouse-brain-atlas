export type MeshData = { positions: Float32Array; indices: Uint32Array };

export function decodeMeshData(buffer: ArrayBuffer): MeshData {
  if (buffer.byteLength < 8) throw new Error("三维网格文件不完整");
  const header = new DataView(buffer);
  const vertexCount = header.getUint32(0, true);
  const triangleCount = header.getUint32(4, true);
  if (!vertexCount || !triangleCount || buffer.byteLength !== 8 + (vertexCount + triangleCount) * 12)
    throw new Error("三维网格文件长度异常");
  const positions = new Float32Array(buffer, 8, vertexCount * 3);
  const indices = new Uint32Array(buffer, 8 + vertexCount * 12, triangleCount * 3);
  if (!positions.every(Number.isFinite)) throw new Error("三维网格坐标无效");
  if (!indices.every((index) => index < vertexCount)) throw new Error("三维网格索引无效");
  return { positions, indices };
}
