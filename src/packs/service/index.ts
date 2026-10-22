import type { BusinessPack } from '../types';

/**
 * সেলুন / সার্ভিস — services are sold without stock, so every sample product is
 * a service. Appointments come later (non-goal for v1).
 */
export const servicePack: BusinessPack = {
  id: 'service',
  labelBn: 'সেলুন / সার্ভিস',
  labelEn: 'Service',
  hintBn: 'চুল কাটা, শেভ, ফেসিয়াল',
  hintEn: 'Haircut, shave, facial',
  icon: 'scissors',
  tone: 'violet',
  terminology: { product: 'সার্ভিস', products: 'সার্ভিস', sale: '' },
  defaultCategories: [
    { nameBn: 'চুল কাটা', nameEn: 'Haircut', icon: 'scissors' },
    { nameBn: 'শেভ', nameEn: 'Shave', icon: 'razor' },
    { nameBn: 'ফেসিয়াল', nameEn: 'Facial', icon: 'sparkles' },
    { nameBn: 'মেহেদী', nameEn: 'Henna', icon: 'hand' },
    { nameBn: 'অন্যান্য', nameEn: 'Others', icon: 'package' },
  ],
  defaultUnits: ['piece'],
  modules: [],
  sampleProducts: [
    {
      nameBn: 'চুল কাটা',
      nameEn: 'Haircut',
      categoryBn: 'চুল কাটা',
      unit: 'piece',
      buyPaisa: 0,
      sellPaisa: 8000,
      stockMilli: 0,
    },
    {
      nameBn: 'দাড়ি শেভ',
      nameEn: 'Beard shave',
      categoryBn: 'শেভ',
      unit: 'piece',
      buyPaisa: 0,
      sellPaisa: 5000,
      stockMilli: 0,
    },
    {
      nameBn: 'ফেসিয়াল',
      nameEn: 'Facial',
      categoryBn: 'ফেসিয়াল',
      unit: 'piece',
      buyPaisa: 15000,
      sellPaisa: 30000,
      stockMilli: 0,
    },
    {
      nameBn: 'মেহেদী',
      nameEn: 'Henna',
      categoryBn: 'মেহেদী',
      unit: 'piece',
      buyPaisa: 5000,
      sellPaisa: 15000,
      stockMilli: 0,
    },
    {
      nameBn: 'চুলে রং',
      nameEn: 'Hair colour',
      categoryBn: 'অন্যান্য',
      unit: 'piece',
      buyPaisa: 20000,
      sellPaisa: 40000,
      stockMilli: 0,
    },
  ],
};
