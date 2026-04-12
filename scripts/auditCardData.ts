import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import type { Card } from '../src/types';
import cardOverrides from '../src/resource/card_data_overrides.json';
import { buildCardProvenance, inferCardSourceType } from '../src/utils/cardDataProfile';

type CardOverrideMap = Record<string, Partial<Card>>;
const overrides = cardOverrides as CardOverrideMap;

const toCardId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const readCards = (): Card[] => {
  const csvPath = path.resolve(process.cwd(), 'src', 'resource', 'original_yugioh_cards.csv');
  const csvData = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csvData, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .filter((row) => row['Card Name'])
    .map((row) => {
      const id = toCardId(row['Card Name']);
      const override = overrides[id] || {};
      const hasExternalOverride = Object.keys(override).length > 0;
      const type =
        row['Attribute'] === 'SPELL'
          ? 'Spell'
          : row['Attribute'] === 'TRAP'
            ? 'Trap'
            : 'Monster';

      const base: Card = {
        id,
        name: row['Card Name'],
        type,
        originalPage: Number.parseInt(row['Original Yu-Gi-Oh! Page'] || '', 10) || undefined,
        matchedSnapshot: row['Matched TCG Snapshot'] === 'Yes',
        passcode: row['Passcode'] || undefined,
        cardStatus: row['Status'] || undefined,
        description: row['Lore / Effect / Description'] || '',
      };

      if (type === 'Monster') {
        const cleanedType = (row['Type'] || '').replace(/^\[/, '').replace(/\]$/, '').trim();
        const typeSegments = cleanedType
          .split('/')
          .map((entry) => entry.replace(/\?/g, '').trim())
          .filter(Boolean);

        base.attribute = row['Attribute'];
        base.level = Number.parseInt(row['Level'] || '0', 10) || 0;
        base.rank = Number.parseInt(row['Rank'] || '0', 10) || undefined;
        base.linkRating = Number.parseInt(row['Link Rating'] || '0', 10) || undefined;
        base.linkArrows = row['Link Arrows']
          ? row['Link Arrows'].split('/').map((entry) => entry.trim()).filter(Boolean)
          : undefined;
        base.pendulumScale = Number.parseInt(row['Pendulum Scale'] || '0', 10) || undefined;
        base.atk = row['ATK'] === '?' ? 0 : Number.parseInt(row['ATK'] || '0', 10) || 0;
        base.def = row['DEF'] === '?' ? 0 : Number.parseInt(row['DEF'] || '0', 10) || 0;
        base.monsterTypeLine = cleanedType || undefined;
        base.monsterRace = typeSegments[0];
        base.monsterAbilities = typeSegments.slice(1);
        base.summoningCondition = row['Summoning Condition'] || undefined;
        base.pendulumEffect = row['Pendulum Effect / Condition'] || undefined;
      } else {
        base.subType = (row['Spell/Trap Property'] as Card['subType']) || undefined;
        base.spellTrapProperty = row['Spell/Trap Property'] || undefined;
      }

      return {
        ...base,
        ...override,
        ...buildCardProvenance({ ...base, ...override }, hasExternalOverride),
        linkArrows: override.linkArrows ?? base.linkArrows,
        monsterAbilities: override.monsterAbilities ?? base.monsterAbilities,
        fusionMaterials: override.fusionMaterials ?? base.fusionMaterials,
        supports: override.supports ?? base.supports,
        antiSupports: override.antiSupports ?? base.antiSupports,
        cardActions: override.cardActions ?? base.cardActions,
        effectTypes: override.effectTypes ?? base.effectTypes,
      };
    });
};

const cards = readCards();
const missingDescription = cards.filter((card) => !card.description.trim());
const missingPasscode = cards.filter((card) => !card.passcode?.trim());
const missingMonsterType = cards.filter((card) => card.type === 'Monster' && !card.monsterTypeLine?.trim());
const unmatchedSnapshot = cards.filter((card) => !card.matchedSnapshot);
const sourceTypeCounts = cards.reduce<Record<string, number>>((counts, card) => {
  const sourceType = inferCardSourceType(card);
  counts[sourceType] = (counts[sourceType] ?? 0) + 1;
  return counts;
}, {});

console.log(`Total cards: ${cards.length}`);
console.log(`Missing description: ${missingDescription.length}`);
console.log(`Missing passcode: ${missingPasscode.length}`);
console.log(`Missing monster type line: ${missingMonsterType.length}`);
console.log(`Not matched to snapshot: ${unmatchedSnapshot.length}`);
Object.entries(sourceTypeCounts)
  .sort(([left], [right]) => left.localeCompare(right))
  .forEach(([sourceType, count]) => {
    console.log(`Source type ${sourceType}: ${count}`);
  });

const weakCards = cards.filter((card) => {
  return (
    !card.description.trim() ||
    !card.passcode?.trim() ||
    (card.type === 'Monster' && !card.monsterTypeLine?.trim())
  );
});

console.log(`Cards still missing key details: ${weakCards.length}`);
weakCards.slice(0, 250).forEach((card) => {
  const missing: string[] = [];
  if (!card.description.trim()) missing.push('description');
  if (!card.passcode?.trim()) missing.push('passcode');
  if (card.type === 'Monster' && !card.monsterTypeLine?.trim()) missing.push('monsterTypeLine');
  console.log(`- ${card.name} [${inferCardSourceType(card)}]: ${missing.join(', ')}`);
});
