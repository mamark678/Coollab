import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file client-side based on its size and converts it to a base64 string.
 * Rules:
 * - Target resolution: max 1280 (width or height)
 * - Under 500KB -> compress to max 300KB (0.3MB)
 * - Between 500KB - 1MB -> compress to max 400KB (0.4MB)
 * - Exceeds 1MB -> compress to max 400KB (0.4MB)
 * - Checks if final base64 string exceeds 700KB. If so, re-compresses with a lower initial quality.
 */
export async function compressAndConvertToBase64(file: File): Promise<string> {
  const originalSizeKB = file.size / 1024;
  let targetSizeMB = 0.4; // fallback

  if (originalSizeKB < 500) {
    targetSizeMB = 0.3;
  } else {
    targetSizeMB = 0.4;
  }

  const options = {
    maxSizeMB: targetSizeMB,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    initialQuality: 0.85
  };

  try {
    let compressedFile = await imageCompression(file, options);
    let base64 = await fileToBase64(compressedFile);

    // Safety guard: if base64 exceeds 700KB, re-compress with lower quality
    // Base64 size is roughly 4/3 of the binary size, so 700KB base64 is ~525KB binary.
    const base64SizeKB = (base64.length * 3) / 4 / 1024;
    if (base64SizeKB > 700) {
      console.warn(`[ImageCompression] Compressed base64 size (${base64SizeKB.toFixed(1)}KB) exceeds 700KB guard. Retrying with lower quality...`);
      const retryOptions = {
        ...options,
        maxSizeMB: targetSizeMB * 0.8,
        initialQuality: 0.6
      };
      compressedFile = await imageCompression(file, retryOptions);
      base64 = await fileToBase64(compressedFile);
    }

    return base64;
  } catch (error) {
    console.error('[ImageCompression] Error compressing image:', error);
    throw error;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
