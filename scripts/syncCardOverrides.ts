import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import type { Card } from '../src/types';

type ApiCard = {
  id?: number;
  name?: string;
  type?: string;
  humanReadableCardType?: string;
  desc?: string;
  race?: string;
  attribute?: string;
  level?: number;
  rank?: number;
  atk?: number;
  def?: number;
  scale?: number;
  linkval?: number;
  linkmarkers?: string[];
};

type OverrideMap = Record<string, Partial<Card>>;

const overridesPath = path.resolve(process.cwd(), 'src', 'resource', 'card_data_overrides.json');
const csvPath = path.resolve(process.cwd(), 'src', 'resource', 'original_yugioh_cards.csv');
const fetchAll = process.argv.includes('--all');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const parseCards = () => {
  const csvData = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csvData, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .filter((row) => row['Card Name'])
    .map((row) => ({
      id: normalizeId(row['Card Name']),
      name: row['Card Name'],
      matched: row['Matched TCG Snapshot'] === 'Yes',
      missingDescription: !row['Lore / Effect / Description'],
      missingType: !row['Type'],
      missingPasscode: !row['Passcode'],
    }));
};

const readExistingOverrides = (): OverrideMap => {
  if (!fs.existsSync(overridesPath)) return {};
  return JSON.parse(fs.readFileSync(overridesPath, 'utf8')) as OverrideMap;
};

const deriveCardType = (apiType?: string): Card['type'] => {
  if (!apiType) return 'Monster';
  if (apiType.toLowerCase().includes('spell')) return 'Spell';
  if (apiType.toLowerCase().includes('trap')) return 'Trap';
  return 'Monster';
};

const deriveMonsterAbilities = (apiType?: string) => {
  if (!apiType) return undefined;
  return apiType
    .replace(/ Monster$/i, '')
    .split(' ')
    .map((entry) => entry.trim())
    .filter((entry) => entry && !/^Effect$/i.test(entry) ? true : entry.toLowerCase() === 'effect');
};

const mapSpellTrapProperty = (race?: string): Card['subType'] | undefined => {
  if (!race) return undefined;
  if (race === 'Quick-Play') return 'Quick-Play';
  if (race === 'Field') return 'Field';
  if (race === 'Continuous') return 'Continuous';
  if (race === 'Equip') return 'Equip';
  if (race === 'Counter') return 'Counter';
  return 'Normal';
};

const buildOverride = (apiCard: ApiCard): Partial<Card> => {
  const cardType = deriveCardType(apiCard.type);
  const override: Partial<Card> = {
    type: cardType,
    matchedSnapshot: true,
    passcode: apiCard.id ? String(apiCard.id) : undefined,
    description: apiCard.desc || undefined,
    attribute: apiCard.attribute || undefined,
    level: apiCard.level || undefined,
    rank: apiCard.rank || undefined,
    atk: typeof apiCard.atk === 'number' ? apiCard.atk : undefined,
    def: typeof apiCard.def === 'number' ? apiCard.def : undefined,
    pendulumScale: apiCard.scale || undefined,
    linkRating: apiCard.linkval || undefined,
    linkArrows: apiCard.linkmarkers?.length ? apiCard.linkmarkers : undefined,
  };

  if (cardType === 'Monster') {
    override.monsterTypeLine = apiCard.humanReadableCardType || apiCard.type || undefined;
    override.monsterRace = apiCard.race || undefined;
    override.monsterAbilities = deriveMonsterAbilities(apiCard.type);
    override.isFusion = apiCard.type?.toLowerCase().includes('fusion') || undefined;
  } else {
    override.spellTrapProperty = apiCard.race || undefined;
    override.subType = mapSpellTrapProperty(apiCard.race);
  }

  return override;
};

const syncOverrides = async () => {
  const cards = parseCards();
  const existingOverrides = readExistingOverrides();
  const targets = fetchAll
    ? cards
    : cards.filter((card) => !card.matched || card.missingDescription || card.missingType || card.missingPasscode);

  const nextOverrides: OverrideMap = { ...existingOverrides };

  for (const [index, card] of targets.entries()) {
    const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(card.name)}&misc=yes`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Skipping ${card.name}: ${response.status}`);
      continue;
    }

    const payload = await response.json() as { data?: ApiCard[] };
    const apiCard = payload.data?.[0];
    if (!apiCard) {
      console.warn(`Skipping ${card.name}: no match returned`);
      continue;
    }

    nextOverrides[card.id] = {
      ...nextOverrides[card.id],
      ...buildOverride(apiCard),
    };

    process.stdout.write(`Synced ${index + 1}/${targets.length}: ${card.name}\n`);
    await sleep(50);
  }

  const sortedOverrides = Object.fromEntries(
    Object.entries(nextOverrides).sort(([left], [right]) => left.localeCompare(right)),
  );

  fs.writeFileSync(overridesPath, `${JSON.stringify(sortedOverrides, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote overrides to ${overridesPath}\n`);
};

void syncOverrides();
