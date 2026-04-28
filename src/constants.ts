/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const BACKGROUNDS = [
  { id: 'street', name: 'Strada', style: { gradient: 'linear-gradient(to bottom, #475569, #1e293b)', image: 'https://images.unsplash.com/photo-1466500419182-8602dc906b51?q=80&w=1170&auto=format&fit=crop' }, icon: 'Road' },
  { id: 'museum', name: 'Museo', style: { gradient: 'linear-gradient(to bottom, #fef3c7, #d97706)', image: 'https://images.unsplash.com/photo-1513038630932-13873b1a7f29?q=80&w=735&auto=format&fit=crop' }, icon: 'Museum' },
  { id: 'shop', name: 'Negozio', style: { gradient: 'linear-gradient(to bottom, #dbeafe, #2563eb)', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800' }, icon: 'ShoppingBag' },
  { id: 'school', name: 'Scuola', style: { gradient: 'linear-gradient(to bottom, #ffedd5, #ea580c)', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=800' }, icon: 'School' },
  { id: 'hotel', name: 'Hotel', style: { gradient: 'linear-gradient(to bottom, #e0e7ff, #4338ca)', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800' }, icon: 'Hotel' },
  { id: 'bar', name: 'Bar', style: { gradient: 'linear-gradient(to bottom, #ecfdf5, #059669)', image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=800' }, icon: 'CupSoda' },
  { id: 'airport', name: 'Aeroporto', style: { gradient: 'linear-gradient(to bottom, #f4f4f5, #52525b)', image: 'https://plus.unsplash.com/premium_photo-1663039978729-6f6775725f89?q=80&w=1169&auto=format&fit=crop' }, icon: 'Plane' },
  { id: 'restaurant', name: 'Ristorante', style: { gradient: 'linear-gradient(to bottom, #fff1f2, #e11d48)', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800' }, icon: 'Utensils' },
];

export const CHARACTERS = [
  { id: 'char1', name: 'Marta', color: '#FF6B6B', emoji: '👩', image: 'https://api.dicebear.com/9.x/avataaars/png?seed=Marta&mouth=smile&eyes=default', gender: 'female' },
  { id: 'char2', name: 'Luca', color: '#4D96FF', emoji: '👨', image: 'https://api.dicebear.com/9.x/avataaars/png?seed=Luca&mouth=smile&eyes=default', gender: 'male' },
  { id: 'char3', name: 'Sofia', color: '#6BCB77', emoji: '👧', image: 'https://api.dicebear.com/9.x/avataaars/png?seed=Sofia&mouth=smile&eyes=default', gender: 'female' },
  { id: 'char4', name: 'Davide', color: '#FFD93D', emoji: '👦', image: 'https://api.dicebear.com/9.x/avataaars/png?seed=Davide&mouth=smile&eyes=default', gender: 'male' },
];

export interface Dialogue {
  id: string;
  characterId: string;
  text: string;
  lang: string;
  voiceIndex: number;
}

export interface VideoProject {
  id: string;
  name: string;
  backgroundId: string;
  dialogues: Dialogue[];
  visibleCharacterIds: string[];
  updatedAt: number;
}
