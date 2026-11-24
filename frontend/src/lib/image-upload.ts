/**
 * Prepara las fotos elegidas en el celular antes de subirlas.
 *
 * Vercel limita el body de cada request a ~4,5 MB y el backend a 4 MB por
 * archivo. Las fotos de los teléfonos suelen superar ese límite, así que se
 * reescriben a JPG de hasta 1600 px (el mismo tope que aplica Sharp después).
 *
 * Importante para iPhone/Safari: las imágenes se decodifican **de a una**.
 * Procesar varias en paralelo con `createImageBitmap` + canvas agota la memoria
 * del navegador y `canvas.toBlob()` devuelve null sin mensaje claro. Acá cada
 * bitmap se cierra y cada canvas se libera apenas termina esa foto.
 *
 * Los HEIC se convierten acá con el decodificador del navegador (iOS Safari lo
 * soporta). El backend no acepta HEIC: solo JPG, PNG y WebP.
 */

const MAX_OUTPUT_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
/** JPG/PNG/WebP chicos se envían intactos: no tiene sentido reprocesarlos. */
const SKIP_REENCODE_MAX_BYTES = 1_500_000;
const DIRECT_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type DecodedImage = ImageBitmap | HTMLImageElement;

interface Decoded {
  image: DecodedImage;
  release: () => void;
}

const decodeImage = async (file: File): Promise<Decoded> => {
  if (typeof createImageBitmap === 'function') {
    try {
      // `from-image` aplica la orientación EXIF antes de dibujar en el canvas.
      const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image, release: () => image.close() };
    } catch {
      // Safari viejo o formatos que solo decode vía <img>: se prueba abajo.
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error(`No se pudo leer "${file.name}". Probá con un JPG o PNG.`));
    });
    // El blob se mantiene vivo hasta que termina el dibujo en el canvas.
    return { image, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
};

const imageDimensions = (image: DecodedImage) => {
  if ('naturalWidth' in image) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }
  return { width: image.width, height: image.height };
};

const compress = async (file: File): Promise<File> => {
  const decoded = await decodeImage(file);
  try {
    const { width, height } = imageDimensions(decoded.image);
    if (!width || !height) {
      throw new Error(`No se pudieron leer las dimensiones de "${file.name}".`);
    }

    const scale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('El navegador no pudo preparar la imagen.');
      // Fondo blanco para PNG/WebP con transparencia: el JPG no conserva alpha.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
      );
      if (!blob) {
        throw new Error(`No se pudo comprimir "${file.name}". Probá con otra foto.`);
      }

      const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
      return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
    } finally {
      // En iOS Safari el canvas queda en memoria hasta que se achica a 0.
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    decoded.release();
  }
};

export const prepareImageForUpload = async (file: File): Promise<File> => {
  if (file.size === 0) throw new Error(`"${file.name}" está vacía.`);
  if (DIRECT_UPLOAD_TYPES.has(file.type.toLowerCase()) && file.size <= SKIP_REENCODE_MAX_BYTES) {
    return file;
  }
  return compress(file);
};
