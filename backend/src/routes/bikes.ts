import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { validate } from './_validation.js';
import {
  list,
  getBySlug,
  trackVisit,
  getById,
  create,
  update,
  remove,
  uploadImages,
  setPrimary,
  deleteImage,
  brands,
  listAdmin,
  reorderImages,
} from '../controllers/bikes.controller.js';
import { authenticateAccess } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { isAllowedImageFilename, isAllowedImageMimeType } from '../services/storage.service.js';

const router = Router();

const bikeQuerySchema = z.object({
  q: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().optional(),
  condition: z.enum(['NUEVA', 'USADA']).optional(),
  usage: z.enum(['ENDURO_CROSS', 'RUTA']).optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  status: z.enum(['BORRADOR', 'DISPONIBLE', 'RESERVADA', 'VENDIDA']).optional(),
  featured: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

const bikeIdSchema = z.object({ id: z.string().cuid('ID de moto inválido') });
const slugSchema = z.object({ slug: z.string().min(1) });
const imageSchema = z.object({
  id: z.string().cuid('ID de moto inválido'),
  imageId: z.string().cuid('ID de imagen inválido'),
});
const reorderSchema = z.object({
  ids: z.array(z.string().cuid('ID de imagen inválido')).min(1),
});

const createBikeSchema = z.object({
  title: z.string().min(2, 'El título es requerido').max(140),
  brandId: z.string().cuid('ID de marca inválido'),
  model: z.string().min(1, 'El modelo es requerido').max(100),
  year: z.coerce.number().int().min(1900).max(2100, 'Año inválido'),
  condition: z.enum(['NUEVA', 'USADA']),
  // null permite volver a "Sin definir" desde el panel.
  usage: z.enum(['ENDURO_CROSS', 'RUTA']).optional().nullable(),
  displacementCc: z.coerce.number().int().positive().optional().nullable(),
  mileageKm: z.coerce.number().int().nonnegative().optional().nullable(),
  // Opcional y decimal. Solo se muestra en fichas de motos usadas con valor > 0.
  usageHours: z.coerce.number().nonnegative('Las horas de uso no pueden ser negativas').optional().nullable(),
  // Opcional: null (o ausente) significa "Precio a consultar".
  price: z.coerce.number().positive('El precio debe ser mayor a 0').optional().nullable(),
  currency: z.string().length(3, 'Moneda inválida').default('ARS'),
  description: z.string().optional().nullable(),
  features: z
    .array(z.object({
      key: z.string().min(1, 'La característica necesita un nombre').max(80),
      value: z.string().min(1, 'La característica necesita un valor').max(200),
    }))
    .max(30)
    .optional(),
  status: z.enum(['BORRADOR', 'DISPONIBLE', 'RESERVADA', 'VENDIDA']).default('DISPONIBLE'),
  featured: z.coerce.boolean().default(false),
});

const updateBikeSchema = createBikeSchema.partial();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(env.MAX_FILE_SIZE) },
  fileFilter: (_req, file, cb) => {
    // Filtro rápido en el borde; Sharp valida el contenido real después.
    if (isAllowedImageMimeType(file.mimetype) || isAllowedImageFilename(file.originalname)) {
      cb(null, true);
    } else {
      const err: any = new Error('Solo se permiten imágenes JPG, PNG o WebP');
      err.statusCode = 400;
      cb(err);
    }
  },
});

// Público
router.get('/', validate(bikeQuerySchema, 'query'), list);
router.get('/brands', brands);
router.get('/slug/:slug', validate(slugSchema, 'params'), getBySlug);

// Privado (panel administrativo). Va antes de /:id para no colisionar con el parámetro.
router.get('/admin', authenticateAccess, validate(bikeQuerySchema, 'query'), listAdmin);

// El detalle por ID solo lo usa el panel: evita exponer borradores por su ID.
router.get('/:id', authenticateAccess, validate(bikeIdSchema, 'params'), getById);
router.post('/:id/visits', validate(bikeIdSchema, 'params'), trackVisit);

// Privado (panel administrativo)
router.post(
  '/',
  authenticateAccess,
  validate(createBikeSchema),
  create,
);
router.patch(
  '/:id',
  authenticateAccess,
  validate(bikeIdSchema, 'params'),
  validate(updateBikeSchema),
  update,
);
router.delete(
  '/:id',
  authenticateAccess,
  validate(bikeIdSchema, 'params'),
  remove,
);
router.post(
  '/:id/images',
  authenticateAccess,
  upload.array('images', 1),
  uploadImages,
);
router.patch(
  '/:id/images/order',
  authenticateAccess,
  validate(bikeIdSchema, 'params'),
  validate(reorderSchema),
  reorderImages,
);
router.patch(
  '/:id/images/:imageId/primary',
  authenticateAccess,
  validate(imageSchema, 'params'),
  setPrimary,
);
router.delete(
  '/:id/images/:imageId',
  authenticateAccess,
  validate(imageSchema, 'params'),
  deleteImage,
);

export default router;
