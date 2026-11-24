import * as React from 'react';
import { ArrowUpRight, Heart, MessageCircle } from 'lucide-react';
import { Link } from '@/components/shared/Link';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import { useFavoritesStore } from '@/stores/favorites';
import { cn } from '@/lib/utils';
import { BUSINESS, buildBikeWhatsAppLink } from '@/lib/constants';
import { formatDisplacement, formatMileage, formatPrice } from '@/lib/format';
import { getThumbnailUrl } from '@/lib/images';
import { ConditionTag, FeaturedTag, StatusTag } from '@/components/public/BikeBadges';
import type { Bike } from '@/types';

interface BikeCardProps {
  bike: Bike;
  className?: string;
  /** Las secciones claras de la home usan la variante light. */
  tone?: 'dark' | 'light';
  /** Tarjeta protagonista: imagen más amplia y tipografía mayor. */
  feature?: boolean;
}

export const BikeCard: React.FC<BikeCardProps> = ({ bike, className, tone = 'dark', feature = false }) => {
  const isFavorite = useFavoritesStore((state) => state.isFavorite(bike.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggle);
  const images = bike.images ?? [];
  const primaryImage = images.find((img) => img.isPrimary) ?? images[0];
  const whatsappLink = buildBikeWhatsAppLink(bike);
  const light = tone === 'light';

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden border transition-colors duration-200',
        light
          ? 'border-black/10 bg-white text-sf-black hover:border-sf-red'
          : 'border-white/10 bg-sf-surface text-white hover:border-sf-red',
        className
      )}
    >
      <div className={cn('relative overflow-hidden bg-black', feature ? 'aspect-[16/10] sm:aspect-[16/9]' : 'aspect-[4/3]')}>
        {primaryImage ? (
          <img
            src={getThumbnailUrl(primaryImage.url)}
            alt={`${bike.brand?.name ?? ''} ${bike.model || bike.title}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <ImagePlaceholder width={800} height={600} label="Foto no disponible" className="h-full w-full" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-sf-black/20" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-sf-red" aria-hidden="true" />

        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <ConditionTag condition={bike.condition} overlay />
          {bike.featured && <FeaturedTag overlay />}
        </div>

        <button
          type="button"
          onClick={() => toggleFavorite(bike.id)}
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center border border-white/30 bg-sf-black/75 text-white transition-colors hover:border-sf-red hover:bg-sf-red"
        >
          <Heart size={18} className={isFavorite ? 'fill-white stroke-white' : ''} strokeWidth={2} />
        </button>

        <div className="absolute bottom-4 left-4">
          <StatusTag status={bike.status} overlay />
        </div>
      </div>

      <div className={cn('flex flex-1 flex-col p-5', feature && 'sm:p-7')}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.28em] text-sf-red">
            {bike.brand?.name ?? BUSINESS.name}
          </p>
          <span className="font-display text-[10px] font-bold tracking-[0.2em] text-gray-500">
            {bike.year}
          </span>
        </div>
        <Link to={`/motos/${bike.slug}`} className="mt-2 block">
          <h3 className={cn(
            'font-display font-extrabold uppercase leading-[0.95] line-clamp-2 transition-colors group-hover:text-sf-red',
            feature ? 'text-3xl sm:text-4xl' : 'text-2xl'
          )}>
            {bike.model || bike.title}
          </h3>
        </Link>
        <p className={cn('mt-2 text-xs', light ? 'text-black/55' : 'text-gray-400')}>
          {formatDisplacement(bike.displacementCc)} ·{' '}
          {formatMileage(bike.condition === 'NUEVA' ? 0 : bike.mileageKm)}
        </p>

        <div className={cn('mt-auto flex items-end justify-between gap-3 border-t pt-4', light ? 'border-black/10' : 'border-white/10')}>
          <div>
            <p className={cn('text-[9px] font-bold uppercase tracking-[0.25em]', light ? 'text-black/45' : 'text-gray-500')}>
              Precio
            </p>
            <p className="mt-0.5 font-display text-2xl font-extrabold leading-none text-sf-red sm:text-3xl">
              {formatPrice(bike.price, bike.currency)}
            </p>
          </div>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Consultar por WhatsApp"
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center border transition-colors',
              light
                ? 'border-black/15 text-black/60 hover:border-sf-red hover:bg-sf-red hover:text-white'
                : 'border-white/15 text-gray-300 hover:border-sf-red hover:bg-sf-red hover:text-white'
            )}
          >
            <MessageCircle size={17} />
          </a>
        </div>

        <Link
          to={`/motos/${bike.slug}`}
          className="mt-4 inline-flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-[0.2em] text-sf-red transition-colors hover:text-sf-red-soft"
        >
          Ver ficha <ArrowUpRight size={15} />
        </Link>
      </div>
    </article>
  );
};
