/**
 * Prepara las fotos elegidas en el celular antes de subirlas.
 *
 * Vercel limita el body de cada request a ~4,5 MB y el backend a 4 MB por
 * archivo. Las fotos de los teléfonos suelen superar ese límite, así que se
 * reescriben a JPG de hasta 1600 px (el mismo tope que aplica Sharp después).
 * También permite enviar HEIC/HEIF: el navegador los decodifica y acá se
 * convierten a JPG, que sí es aceptado por la API.
 */

const MAX_OUTPUT_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
/** JPG/PNG/WebP chicos se envían intactos: no tiene sentido reprocesarlos. */
const SKIP_REENCODE_MAX_BYTES = 1_500_000;
const DIRECT_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type DecodedImage = ImageBitmap | HTMLImageElement;

const decodeImage = async (file: File): Promise<DecodedImage> => {
  if (typeof createImageBitmap === 'function') {
    try {
      // `from-image` aplica la orientación EXIF antes de dibujar en el canvas.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Safari viejo o formatos que solo decode vía <img>: se prueba abajo.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error(`No se pudo leer "${file.name}". Probá con un JPG o PNG.`));
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const compress = async (file: File): Promise<File> => {
  const image = await decodeImage(file);
  const width = image.width;
  const height = image.height;
  if (!width || !height) {
    if ('close' in image) image.close();
    throw new Error(`No se pudieron leer las dimensiones de "${file.name}".`);
  }

  const scale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no pudo preparar la imagen.');
  // Fondo blanco para PNG/WebP con transparencia: el JPG no conserva alpha.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ('close' in image) image.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob) throw new Error(`No se pudo comprimir "${file.name}". Probá con otra foto.`);

  const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
};

export const prepareImageForUpload = async (file: File): Promise<File> => {
  if (file.size === 0) throw new Error(`"${file.name}" está vacía.`);
  if (DIRECT_UPLOAD_TYPES.has(file.type.toLowerCase()) && file.size <= SKIP_REENCODE_MAX_BYTES) {
    return file;
  }
  return compress(file);
};
