/** Divide un arreglo en bloques de tamaño `size` (útil para respetar el límite de 500 ops de writeBatch). */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
