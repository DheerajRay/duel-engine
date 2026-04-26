import type { Card } from '../types';
import { CARD_LOCALIZATIONS } from './gameContentStore';
import type { AppLanguage } from '../types/preferences';
import type { TranslationKey } from '../i18n/messages';

export const getLocalizedCardText = (
  card: Pick<Card, 'id' | 'name' | 'description'>,
  language: AppLanguage,
) => {
  const localized = CARD_LOCALIZATIONS[language]?.[card.id] ?? CARD_LOCALIZATIONS.en?.[card.id];

  return {
    name: localized?.name || card.name,
    description: localized?.description || card.description,
  };
};

export const getCardTypeTranslationKey = (type: Card['type']): TranslationKey => {
  switch (type) {
    case 'Spell':
      return 'cardTypeSpell';
    case 'Trap':
      return 'cardTypeTrap';
    case 'Monster':
    default:
      return 'cardTypeMonster';
  }
};

export const getCardSubtypeTranslationKey = (subType?: Card['subType']): TranslationKey | null => {
  switch (subType) {
    case 'Equip':
      return 'cardTypeEquip';
    case 'Field':
      return 'cardTypeField';
    case 'Quick-Play':
      return 'cardTypeQuickPlay';
    case 'Continuous':
      return 'cardTypeContinuous';
    case 'Counter':
      return 'cardTypeCounter';
    case 'Normal':
      return 'cardTypeNormal';
    default:
      return null;
  }
};

export const getLocalizedSupportStatusKey = (status: Card['effectSupportStatus']): TranslationKey => {
  switch (status) {
    case 'implemented':
      return 'effectSupportImplemented';
    case 'partial':
      return 'effectSupportPartial';
    case 'unsupported':
    default:
      return 'effectSupportUnsupported';
  }
};
