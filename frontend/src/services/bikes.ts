import api from '@/lib/api';
import { requireArray, requireObject, requirePaginated } from '@/lib/api-response';
import type {
  Bike,
  BikeImage,
  BikeCondition,
  BikeStatus,
  BikeUsage,
} from '@/types';

export interface BikeFilters {
  q?: string;
  brand?: string;
  model?: string;
  year?: number;
  condition?: BikeCondition;
  usage?: BikeUsage;
  displacementMin?: number;
  displacementMax?: number;
  priceMin?: number;
  priceMax?: number;
  status?: BikeStatus;
  featured?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateBikeInput {
  title: string;
  brandId: string;
  model: string;
  year: number;
  condition: BikeCondition;
  /** null vuelve a dejar la moto sin clasificar. */
  usage?: BikeUsage | null;
  displacementCc?: number | null;
  mileageKm?: number | null;
  /** Decimal opcional; se envía null para motos 0 km o cuando no hay dato. */
  usageHours?: number | null;
  /** Omitir o enviar null cuando el precio no está declarado. */
  price?: number | null;
  currency?: string;
  description?: string | null;
  features?: Array<{ key: string; value: string }>;
  status: BikeStatus;
  featured?: boolean;
}

export interface UpdateBikeInput extends Partial<CreateBikeInput> {}

const BASE = '/bikes';

/** Las listas opcionales se normalizan para que ningún componente iterate `undefined`. */
const normalizeBike = (value: unknown): Bike => {
  const bike = requireObject<Bike>(value, 'moto');
  return {
    ...bike,
    images: Array.isArray(bike.images) ? bike.images : [],
    features: Array.isArray(bike.features) ? bike.features : [],
  };
};

export const bikesService = {
  /** Catálogo público con filtros y paginación */
  list: async (filters: BikeFilters = {}) => {
    const { data } = await api.get(BASE, { params: filters });
    const page = requirePaginated<Bike>(data);
    return { ...page, data: page.data.map(normalizeBike) };
  },

  /** Listado del panel: incluye borradores (el catálogo público los oculta) */
  listAdmin: async (filters: BikeFilters = {}) => {
    const { data } = await api.get(`${BASE}/admin`, { params: filters });
    const page = requirePaginated<Bike>(data);
    return { ...page, data: page.data.map(normalizeBike) };
  },

  /** Ficha individual por slug */
  getBySlug: async (slug: string) => {
    const { data } = await api.get(`${BASE}/slug/${slug}`);
    return normalizeBike(data);
  },

  /** Detalle por ID (panel/admin) */
  getById: async (id: string) => {
    const { data } = await api.get(`${BASE}/${id}`);
    return normalizeBike(data);
  },

  /** Crear publicación (admin) */
  create: async (input: CreateBikeInput) => {
    const { data } = await api.post(BASE, input);
    return normalizeBike(data);
  },

  /** Editar publicación (admin) */
  update: async (id: string, input: UpdateBikeInput) => {
    const { data } = await api.patch(`${BASE}/${id}`, input);
    return normalizeBike(data);
  },

  /** Eliminar publicación (admin) */
  remove: async (id: string) => {
    const { data } = await api.delete<{ ok: boolean }>(`${BASE}/${id}`);
    return data;
  },

  /**
   * Subir imágenes de una moto, de a una por request.
   * Vercel limita el body a ~4.5 MB y el backend procesa cada archivo con Sharp.
   */
  uploadImages: async (bikeId: string, files: FileList | File[]) => {
    const fileArray = Array.isArray(files) ? files : Array.from(files);
    let images: BikeImage[] = [];

    for (const file of fileArray) {
      const formData = new FormData();
      formData.append('images', file);
      const { data } = await api.post(
        `${BASE}/${bikeId}/images`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const body = requireObject<{ images?: unknown }>(data, 'respuesta');
      images = requireArray<BikeImage>(body.images, 'galería');
    }

    return { images };
  },

  /** Establecer imagen principal */
  setPrimaryImage: async (bikeId: string, imageId: string) => {
    const { data } = await api.patch(`${BASE}/${bikeId}/images/${imageId}/primary`);
    const body = requireObject<{ images?: unknown }>(data, 'respuesta');
    return { images: requireArray<BikeImage>(body.images, 'galería') };
  },

  /** Reordenar las fotografías existentes (se envía el listado completo de IDs) */
  reorderImages: async (bikeId: string, ids: string[]) => {
    const { data } = await api.patch(`${BASE}/${bikeId}/images/order`, { ids });
    const body = requireObject<{ images?: unknown }>(data, 'respuesta');
    return { images: requireArray<BikeImage>(body.images, 'galería') };
  },

  /** Eliminar una imagen */
  deleteImage: async (bikeId: string, imageId: string) => {
    const { data } = await api.delete<{ ok: boolean }>(
      `${BASE}/${bikeId}/images/${imageId}`
    );
    return data;
  },

  /** Registrar una visita/interés (público) */
  trackVisit: async (bikeId: string) => {
    await api.post(`/bikes/${bikeId}/visits`);
  },

  /** Marcas disponibles */
  listBrands: async () => {
    const { data } = await api.get('/bikes/brands');
    return requireArray<{ id: string; name: string; slug: string }>(data, 'lista de marcas');
  },
};
