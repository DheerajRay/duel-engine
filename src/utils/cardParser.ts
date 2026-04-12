import Papa from 'papaparse';
import { Card } from '../types';
import csvData from '../resource/original_yugioh_cards.csv?raw';
import cardOverrides from '../resource/card_data_overrides.json';
import { buildCardProvenance } from './cardDataProfile';

export const LOCAL_CARD_DB: Record<string, Card> = {};

type CardOverrideMap = Record<string, Partial<Card>>;

const overrides = cardOverrides as CardOverrideMap;

const parseOptionalInt = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseArrayField = (value: string | undefined) => {
  if (!value) return undefined;
  const items = value
    .split('/')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
};

const parseTypeLine = (rawType: string | undefined) => {
  if (!rawType) {
    return { monsterTypeLine: undefined, monsterRace: undefined, monsterAbilities: undefined, isFusion: false };
  }

  const cleaned = rawType.replace(/^\[/, '').replace(/\]$/, '').trim();
  const segments = cleaned.split('/').map((entry) => entry.replace(/\?/g, '').trim()).filter(Boolean);
  const monsterRace = segments[0];
  const abilities = segments.slice(1);

  return {
    monsterTypeLine: cleaned || undefined,
    monsterRace: monsterRace || undefined,
    monsterAbilities: abilities.length > 0 ? abilities : undefined,
    isFusion: abilities.some((entry) => entry.toLowerCase() === 'fusion'),
  };
};

const parsed = Papa.parse(csvData, {
  header: true,
  skipEmptyLines: true,
});

parsed.data.forEach((row: any) => {
  if (!row['Card Name']) return;
  
  const id = row['Card Name'].toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const override = overrides[id] || {};
  const hasExternalOverride = Object.keys(override).length > 0;
  
  let type: 'Monster' | 'Spell' | 'Trap' = 'Monster';
  if (row['Attribute'] === 'SPELL') {
    type = 'Spell';
  } else if (row['Attribute'] === 'TRAP') {
    type = 'Trap';
  } else {
    type = 'Monster';
  }

  const card: Card = {
    id,
    name: row['Card Name'],
    type,
    originalPage: parseOptionalInt(row['Original Yu-Gi-Oh! Page']),
    matchedSnapshot: row['Matched TCG Snapshot'] === 'Yes',
    passcode: row['Passcode'] || undefined,
    cardStatus: row['Status'] || undefined,
    description: row['Lore / Effect / Description'] || '',
  };

  if (type === 'Monster') {
    const typeLine = parseTypeLine(row['Type']);
    card.attribute = row['Attribute'] || undefined;
    card.level = parseOptionalInt(row['Level']);
    card.rank = parseOptionalInt(row['Rank']);
    card.linkRating = parseOptionalInt(row['Link Rating']);
    card.linkArrows = parseArrayField(row['Link Arrows']);
    card.pendulumScale = parseOptionalInt(row['Pendulum Scale']);
    card.atk = row['ATK'] === '?' ? 0 : parseOptionalInt(row['ATK']);
    card.def = row['DEF'] === '?' ? 0 : parseOptionalInt(row['DEF']);
    card.monsterTypeLine = typeLine.monsterTypeLine;
    card.monsterRace = typeLine.monsterRace;
    card.monsterAbilities = typeLine.monsterAbilities;
    card.isFusion = typeLine.isFusion || undefined;
    card.summoningCondition = row['Summoning Condition'] || undefined;
    card.pendulumEffect = row['Pendulum Effect / Condition'] || undefined;

    if (card.isFusion) {
      const condition = row['Summoning Condition'] || row['Lore / Effect / Description'] || '';
      card.fusionMaterials = condition
        .split('+')
        .map((m: string) => m.replace(/"/g, '').trim())
        .filter(Boolean);
    }
  } else {
    card.subType = row['Spell/Trap Property'] as any;
    card.spellTrapProperty = row['Spell/Trap Property'] || undefined;
  }

  card.supports = parseArrayField(row['Supports']);
  card.antiSupports = parseArrayField(row['Anti-Supports']);
  card.cardActions = parseArrayField(row['Card Actions']);
  card.effectTypes = parseArrayField(row['Effect Types']);

  const mergedCard: Card = {
    ...card,
    ...override,
    ...buildCardProvenance({ ...card, ...override }, hasExternalOverride),
    fusionMaterials: override.fusionMaterials ?? card.fusionMaterials,
    linkArrows: override.linkArrows ?? card.linkArrows,
    monsterAbilities: override.monsterAbilities ?? card.monsterAbilities,
    supports: override.supports ?? card.supports,
    antiSupports: override.antiSupports ?? card.antiSupports,
    cardActions: override.cardActions ?? card.cardActions,
    effectTypes: override.effectTypes ?? card.effectTypes,
  };

  LOCAL_CARD_DB[id] = mergedCard;
});
