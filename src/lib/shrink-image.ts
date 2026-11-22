/** Browser only. Shrinks a big photo so it uploads quickly; keeps PNG as PNG (logos can be transparent). Falls back to the original file. */
export async function shrinkImage(file: File, maxSide: number, keepBelowBytes = 1_500_000): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= keepBelowBytes) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
    return blob ? new File([blob], type === "image/png" ? "image.png" : "image.jpg", { type }) : file;
  } catch { return file; }
}
