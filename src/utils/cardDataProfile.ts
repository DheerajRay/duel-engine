import type {
  Card,
  CardSourceType,
  CardTextSource,
  CardVerificationStatus,
} from '../types';

export interface CardMissingDetailFlags {
  missingDescription: boolean;
  missingPasscode: boolean;
  missingMonsterTypeLine: boolean;
}

export const getMissingCardDetailFlags = (card: Partial<Card>): CardMissingDetailFlags => ({
  missingDescription: !card.description?.trim(),
  missingPasscode: !card.passcode?.trim(),
  missingMonsterTypeLine: card.type === 'Monster' && !card.monsterTypeLine?.trim(),
});

export const inferCardSourceType = (card: Partial<Card>): CardSourceType => {
  if (card.sourceType) return card.sourceType;
  if (card.matchedSnapshot) return 'official';

  const flags = getMissingCardDetailFlags(card);
  if (flags.missingDescription && flags.missingPasscode) {
    return 'custom';
  }

  return 'unknown';
};

export const inferCardTextSource = (card: Partial<Card>, hasExternalOverride: boolean): CardTextSource => {
  if (card.textSource) return card.textSource;
  if (hasExternalOverride) return 'mixed';
  return 'csv';
};

export const inferCardVerificationStatus = (card: Partial<Card>): CardVerificationStatus => {
  if (card.verificationStatus) return card.verificationStatus;

  const flags = getMissingCardDetailFlags(card);
  if (!flags.missingDescription && !flags.missingPasscode && !flags.missingMonsterTypeLine && card.matchedSnapshot) {
    return 'verified';
  }

  if (!flags.missingDescription || !flags.missingPasscode || !flags.missingMonsterTypeLine) {
    return 'needs_review';
  }

  return 'unverified';
};

export const inferCardNotes = (card: Partial<Card>, hasExternalOverride: boolean): string | undefined => {
  if (card.notes?.trim()) return card.notes;

  const sourceType = inferCardSourceType(card);
  const verificationStatus = inferCardVerificationStatus(card);
  const flags = getMissingCardDetailFlags(card);

  if (verificationStatus === 'verified' && hasExternalOverride) {
    return 'Merged from local CSV and verified external card data.';
  }

  if (sourceType === 'custom' && flags.missingDescription && flags.missingPasscode) {
    return 'No verified external match found. Likely custom or anime-only card that needs manual review.';
  }

  if (verificationStatus === 'needs_review') {
    return 'Card data is partially populated but still needs manual review.';
  }

  return undefined;
};

export const buildCardProvenance = (card: Partial<Card>, hasExternalOverride: boolean) => ({
  sourceType: inferCardSourceType(card),
  textSource: inferCardTextSource(card, hasExternalOverride),
  verificationStatus: inferCardVerificationStatus(card),
  notes: inferCardNotes(card, hasExternalOverride),
});
