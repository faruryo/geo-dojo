import type { LucideIcon } from 'lucide-react';
import { MapPin, List } from 'lucide-react';

export type MunicipalityQuizMode = 'A' | 'B' | 'C' | 'D';

export type ModeCatalogEntry = {
  key: MunicipalityQuizMode;
  shortLabel: string;
  longLabel: string;
  description: string;
  Icon: LucideIcon;
};

export const MUNICIPALITY_MODE_CATALOG: ModeCatalogEntry[] = [
  {
    key: 'A',
    shortLabel: 'モードA',
    longLabel: '県当て（地図）',
    description: '市区町村名から所属県を日本地図で答える。本番。',
    Icon: MapPin,
  },
  {
    key: 'B',
    shortLabel: 'モードB',
    longLabel: '県当て（4択）・練習',
    description: '市区町村名から所属県を4択で答える練習。',
    Icon: List,
  },
  {
    key: 'C',
    shortLabel: 'モードC',
    longLabel: '市当て（4択）・練習',
    description: '都道府県名から市区町村を4択で答える練習。',
    Icon: List,
  },
  {
    key: 'D',
    shortLabel: 'モードD',
    longLabel: '場所当て（地図）',
    description: '市区町村の位置を地図でタップして答える。',
    Icon: MapPin,
  },
];
