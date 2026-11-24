import { BIKE_USAGES } from '@/lib/constants';
import type { BikeCondition, BikeStatus, BikeUsage } from '@/types';

/** Formato monetario único para todo el frontend. */
export const formatPrice = (price: number | null | undefined, currency = 'ARS') =>
  price == null ? 'Precio a consultar' : `$${price.toLocaleString('es-AR')} ${currency}`;

/** Kilometraje opcional: null se muestra como "Sin dato", nunca como 0 km. */
export const formatMileage = (km: number | null | undefined) =>
  km == null ? 'Sin dato' : `${km.toLocaleString('es-AR')} km`;

export const formatDisplacement = (cc: number | null | undefined) =>
  cc ? `${cc} cc` : 'A confirmar';

/**
 * Horas de uso: null/undefined/0 se consideran "sin dato" y devuelven null
 * para que la ficha pública no muestre valores vacíos ni inventados.
 */
export const formatUsageHours = (hours: number | null | undefined) => {
  if (hours == null || hours <= 0) return null;
  const value = hours.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return `${value} ${hours === 1 ? 'hora' : 'horas'}`;
};

export const conditionLabel = (condition: BikeCondition) =>
  condition === 'NUEVA' ? '0 km' : 'Usada';

export const usageLabel = (usage: BikeUsage | null | undefined) =>
  BIKE_USAGES.find((item) => item.value === usage)?.label ?? 'Sin definir';

export const statusLabel = (status: BikeStatus) =>
  status === 'BORRADOR'
    ? 'Borrador'
    : status === 'DISPONIBLE'
      ? 'Disponible'
      : status === 'RESERVADA'
        ? 'Reservada'
        : 'Vendida';

/** Convierte claves técnicas (ej. "front_suspension") en etiquetas legibles. */
export const featureLabel = (key: string) =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
