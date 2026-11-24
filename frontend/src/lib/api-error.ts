import axios from 'axios';

/** Etiquetas legibles para los campos que valida la API. */
const FIELD_LABELS: Record<string, string> = {
  title: 'título',
  brandId: 'marca',
  model: 'modelo',
  year: 'año',
  price: 'precio',
  currency: 'moneda',
  condition: 'estado',
  usage: 'uso',
  displacementCc: 'cilindrada',
  mileageKm: 'kilometraje',
  usageHours: 'horas de uso',
  description: 'descripción',
  features: 'características',
};

const validationDetail = (errors: Record<string, string[]>) =>
  Object.entries(errors)
    .map(([field, messages]) => {
      const label = FIELD_LABELS[field] ?? field;
      return `${label}: ${messages.join(', ')}`;
    })
    .join(' · ');

/**
 * Convierte un error de la API en un mensaje accionable. Antes el panel mostraba
 * siempre "Revisá los datos", aunque el problema fuera una foto grande o una
 * sesión vencida.
 */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 413) {
      return 'Una foto supera el tamaño permitido. Probá con imágenes más livianas.';
    }
    if (status === 401) {
      return 'La sesión venció. Iniciá sesión de nuevo e intentá guardar otra vez.';
    }
    if (!error.response) {
      return 'No se pudo conectar con el servidor. Revisá la conexión e intentá de nuevo.';
    }
    if (data && typeof data === 'object') {
      const body = data as { message?: unknown; errors?: unknown };
      if (body.errors && typeof body.errors === 'object') {
        const detail = validationDetail(body.errors as Record<string, string[]>);
        if (detail) return `Revisá los datos (${detail}).`;
      }
      if (typeof body.message === 'string' && body.message) return body.message;
    }
    return fallback;
  }

  return error instanceof Error && error.message ? error.message : fallback;
};
