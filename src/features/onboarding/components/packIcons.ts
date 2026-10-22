import {
  Baby,
  Cake,
  Cookie,
  CupSoda,
  Droplets,
  FlaskConical,
  Footprints,
  Package,
  Pill,
  Scissors,
  Shirt,
  Store,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import type { BusinessPack } from '@/packs';

/**
 * Pack icon and colour, kept out of the component file so Fast Refresh keeps
 * working (a module may either export components or helpers, not both).
 * Unknown icon names fall back to the generic parcel, so bad pack data can
 * never render a blank card.
 */
const ICONS: Record<string, LucideIcon> = {
  wheat: Wheat,
  pill: Pill,
  shirt: Shirt,
  utensils: UtensilsCrossed,
  scissors: Scissors,
  store: Store,
  package: Package,
  flask: FlaskConical,
  droplets: Droplets,
  'cup-soda': CupSoda,
  cookie: Cookie,
  cake: Cake,
  footprints: Footprints,
  baby: Baby,
};

export const PACK_TONES: Record<BusinessPack['tone'], string> = {
  emerald: 'bg-money-in/10 text-money-in',
  sky: 'bg-sky-500/10 text-sky-400',
  rose: 'bg-rose-500/10 text-rose-400',
  amber: 'bg-warning/10 text-warning',
  violet: 'bg-violet-500/10 text-violet-400',
  slate: 'bg-muted text-muted-foreground',
};

export function packIcon(pack: BusinessPack): LucideIcon {
  return ICONS[pack.icon] ?? Package;
}
