import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import type { Card } from '../src/types';

type OverrideMap = Record<string, Partial<Card>>;

const overridesPath = path.resolve(process.cwd(), 'src', 'resource', 'card_data_overrides.json');
const csvPath = path.resolve(process.cwd(), 'src', 'resource', 'original_yugioh_cards.csv');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const readExistingOverrides = (): OverrideMap => {
  if (!fs.existsSync(overridesPath)) return {};
  return JSON.parse(fs.readFileSync(overridesPath, 'utf8')) as OverrideMap;
};

const isMeaningfulText = (value?: string) => Boolean(value && value.trim() && value.trim() !== '[Ticket]');

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
      type:
        row['Attribute'] === 'SPELL'
          ? 'Spell'
          : row['Attribute'] === 'TRAP'
            ? 'Trap'
            : 'Monster',
      description: row['Lore / Effect / Description'] || '',
      passcode: row['Passcode'] || '',
      matchedSnapshot: row['Matched TCG Snapshot'] === 'Yes',
      monsterTypeLine: row['Type'] || '',
      spellTrapProperty: row['Spell/Trap Property'] || '',
      attribute: row['Attribute'] || '',
      level: row['Level'] || '',
      rank: row['Rank'] || '',
      atk: row['ATK'] || '',
      def: row['DEF'] || '',
    }));
};

const stripWikiMarkup = (value: string) => {
  return value
    .replace(/<!--.*?-->/gs, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{Ruby\|([^|}]+)\|[^}]+\}\}/g, '$1')
    .replace(/\{\{PAGENAME\}\}/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/''+/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const extractFirstProseParagraph = (content: string) => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('{{'))
    .filter((line) => !line.startsWith('}}'))
    .filter((line) => !line.startsWith('|'))
    .filter((line) => !line.startsWith('[['))
    .filter((line) => !line.startsWith('=='))
    .filter((line) => !line.startsWith('*'));

  for (const line of lines) {
    const cleaned = stripWikiMarkup(line);
    if (cleaned.length > 20 && !/^Main article:/i.test(cleaned) && !/^About\b/i.test(cleaned)) {
      return cleaned;
    }
  }

  return undefined;
};

const parseTemplateFields = (content: string) => {
  const fields: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  const flush = () => {
    if (!currentKey) return;
    fields[currentKey] = currentValue.join('\n').trim();
    currentKey = null;
    currentValue = [];
  };

  for (const line of lines) {
    const keyMatch = line.match(/^\|\s*([^=]+?)\s*=\s*(.*)$/);
    if (keyMatch) {
      flush();
      currentKey = keyMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
      currentValue.push(keyMatch[2]);
      continue;
    }

    if (currentKey) {
      if (line.startsWith('|') || line.startsWith('}}')) {
        flush();
      } else {
        currentValue.push(line);
      }
    }
  }

  flush();
  return fields;
};

const parseProperty = (value?: string): Card['subType'] | undefined => {
  if (!value) return undefined;
  const cleaned = stripWikiMarkup(value);
  if (cleaned === 'Quick-Play') return 'Quick-Play';
  if (cleaned === 'Field') return 'Field';
  if (cleaned === 'Continuous') return 'Continuous';
  if (cleaned === 'Equip') return 'Equip';
  if (cleaned === 'Counter') return 'Counter';
  if (cleaned === 'Normal') return 'Normal';
  return undefined;
};

const parseMonsterTypeLine = (fields: Record<string, string>) => {
  const explicitTypes = fields.types ? stripWikiMarkup(fields.types) : '';
  const raceOnly = fields.type ? stripWikiMarkup(fields.type) : '';
  const effectTypes = fields.effect_types
    ? stripWikiMarkup(fields.effect_types)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  if (explicitTypes) {
    return explicitTypes.replace(/\s*\/\s*/g, ' / ');
  }

  if (raceOnly && effectTypes.length > 0) {
    return [raceOnly, ...effectTypes].join(' / ');
  }

  if (raceOnly && fields.lore?.includes("''")) {
    return `${raceOnly} / Normal`;
  }

  return raceOnly || undefined;
};

const parseAbilities = (monsterTypeLine?: string) => {
  if (!monsterTypeLine) return undefined;
  const segments = monsterTypeLine.split('/').map((entry) => entry.trim()).filter(Boolean);
  return segments.length > 1 ? segments.slice(1) : undefined;
};

const parseSourceType = (content: string, title: string): Card['sourceType'] | undefined => {
  if (/^\{\{Anime card/i.test(content)) return 'anime';
  if (/^\{\{DBT card/i.test(content)) return 'custom';
  if (/Unofficial name/i.test(content) || /\bVG\b/i.test(title)) return 'custom';
  if (/^\{\{CardTable2/i.test(content)) return 'official';
  return undefined;
};

const fetchWikiContent = async (name: string) => {
  const url = `https://yugioh.fandom.com/api.php?action=query&redirects=1&titles=${encodeURIComponent(
    name,
  )}&prop=revisions&rvslots=main&rvprop=content&format=json&origin=*`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'DuelEngineCardSync/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Wiki fetch failed for ${name}: ${response.status}`);
  }

  const payload = await response.json() as any;

  const pages = (payload.query?.pages ?? {}) as Record<string, any>;
  const page = Object.values(pages)[0] as any;
  if (!page || page.missing) return null;

  return {
    title: page.title ?? name,
    content: page.revisions?.[0]?.slots?.main?.['*'] ?? '',
  };
};

const searchWikiTitles = async (name: string) => {
  const url = `https://yugioh.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    `"${name}"`,
  )}&srlimit=5&format=json&origin=*`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'DuelEngineCardSync/1.0' },
  });

  if (!response.ok) return [];
  const payload = await response.json() as any;
  const results = payload?.query?.search ?? [];
  return results
    .map((entry: any) => String(entry.title))
    .filter((title: string) => !title.startsWith('Card Gallery:'))
    .filter((title: string) => !title.startsWith('Category:'));
};

const buildOverride = (title: string, content: string): Partial<Card> => {
  const fields = parseTemplateFields(content);
  const loreCandidates = [
    fields.lore,
    fields.card_text,
    fields.text,
    fields.effect,
    fields.rod_lore,
    fields.tsc_lore,
    fields.eds_lore,
    fields.vd_lore,
    fields.anime_lore,
    fields.summary,
    fields.effect_text,
  ].map((entry) => stripWikiMarkup(entry || ''));
  const lore = loreCandidates.find((entry) => isMeaningfulText(entry));
  const sourceType = parseSourceType(content, title);
  const monsterTypeLine = parseMonsterTypeLine(fields);
  const limitationText = stripWikiMarkup(fields.limitation_text || '');
  const introParagraph = extractFirstProseParagraph(content);

  let description = lore;
  if (!isMeaningfulText(description) && isMeaningfulText(limitationText)) {
    description = limitationText;
  }
  if (!isMeaningfulText(description) && isMeaningfulText(introParagraph)) {
    description = introParagraph;
  }
  if (!isMeaningfulText(description) && /^\{\{Anime card/i.test(content)) {
    description = 'Anime-only card entry. No published English lore text is currently available from the source page.';
  }
  if (!isMeaningfulText(description) && /type\s*=\s*Non-game card/i.test(content)) {
    description = 'Non-game card. This entry cannot be used in a Duel.';
  }

  const override: Partial<Card> = {
    description: description || undefined,
    passcode: stripWikiMarkup(fields.passcode || fields.password || '') || undefined,
    attribute: stripWikiMarkup(fields.attribute || '') || undefined,
    spellTrapProperty: stripWikiMarkup(fields.property || '') || undefined,
    subType: parseProperty(fields.property),
    sourceType,
    notes: 'Backfilled from Yu-Gi-Oh Wiki/Fandom.',
  };

  if (fields.level) override.level = Number.parseInt(stripWikiMarkup(fields.level), 10) || undefined;
  if (fields.rank) override.rank = Number.parseInt(stripWikiMarkup(fields.rank), 10) || undefined;
  if (fields.atk && stripWikiMarkup(fields.atk) !== '?') {
    override.atk = Number.parseInt(stripWikiMarkup(fields.atk), 10) || undefined;
  }
  if (fields.def && stripWikiMarkup(fields.def) !== '?') {
    override.def = Number.parseInt(stripWikiMarkup(fields.def), 10) || undefined;
  }
  if (monsterTypeLine) {
    override.monsterTypeLine = monsterTypeLine;
    const segments = monsterTypeLine.split('/').map((entry) => entry.trim()).filter(Boolean);
    override.monsterRace = segments[0];
    override.monsterAbilities = parseAbilities(monsterTypeLine);
    override.isFusion = segments.some((entry) => entry.toLowerCase() === 'fusion');
  }

  return override;
};

const shouldTargetCard = (card: ReturnType<typeof parseCards>[number], override?: Partial<Card>) => {
  const mergedDescription = override?.description || card.description;
  const mergedPasscode = override?.passcode || card.passcode;
  const mergedMonsterTypeLine = override?.monsterTypeLine || card.monsterTypeLine;
  return (
    !mergedDescription.trim() ||
    !mergedPasscode.trim() ||
    (card.type === 'Monster' && !mergedMonsterTypeLine.trim()) ||
    (card.type !== 'Monster' && !((override?.spellTrapProperty || card.spellTrapProperty).trim()))
  );
};

const scorePatch = (patch: Partial<Card>) => {
  let score = 0;
  if (patch.description?.trim()) score += 4;
  if (patch.passcode?.trim()) score += 2;
  if (patch.monsterTypeLine?.trim()) score += 2;
  if (patch.attribute?.trim()) score += 1;
  if (patch.spellTrapProperty?.trim()) score += 1;
  return score;
};

const syncWikiOverrides = async () => {
  const cards = parseCards();
  const existingOverrides = readExistingOverrides();
  const targets = cards.filter((card) => shouldTargetCard(card, existingOverrides[card.id]));

  const nextOverrides: OverrideMap = { ...existingOverrides };
  let synced = 0;

  for (const [index, card] of targets.entries()) {
    try {
      const candidateTitles = [card.name, ...(await searchWikiTitles(card.name))].filter(
        (title, index, list) => list.indexOf(title) === index,
      );

      let bestPatch: Partial<Card> | null = null;

      for (const candidateTitle of candidateTitles) {
        const wikiPage = await fetchWikiContent(candidateTitle);
        if (!wikiPage) continue;

        const patch = buildOverride(wikiPage.title, wikiPage.content);
        if (!bestPatch || scorePatch(patch) > scorePatch(bestPatch)) {
          bestPatch = patch;
        }

        if (scorePatch(bestPatch) >= 6) break;
      }

      if (!bestPatch) {
        process.stdout.write(`No wiki page for ${card.name}\n`);
        continue;
      }

      const current = nextOverrides[card.id] ?? {};
      nextOverrides[card.id] = {
        ...current,
        description: current.description || bestPatch.description,
        passcode: current.passcode || bestPatch.passcode,
        attribute: current.attribute || bestPatch.attribute,
        level: current.level ?? bestPatch.level,
        rank: current.rank ?? bestPatch.rank,
        atk: current.atk ?? bestPatch.atk,
        def: current.def ?? bestPatch.def,
        monsterTypeLine: current.monsterTypeLine || bestPatch.monsterTypeLine,
        monsterRace: current.monsterRace || bestPatch.monsterRace,
        monsterAbilities: current.monsterAbilities ?? bestPatch.monsterAbilities,
        spellTrapProperty: current.spellTrapProperty || bestPatch.spellTrapProperty,
        subType: current.subType || bestPatch.subType,
        isFusion: current.isFusion ?? bestPatch.isFusion,
        sourceType: current.sourceType || bestPatch.sourceType,
        notes: bestPatch.notes,
      };

      synced += 1;
      process.stdout.write(`Wiki synced ${index + 1}/${targets.length}: ${card.name}\n`);
      await sleep(75);
    } catch (error) {
      process.stdout.write(`Wiki sync failed for ${card.name}: ${String(error)}\n`);
    }
  }

  const sortedOverrides = Object.fromEntries(
    Object.entries(nextOverrides).sort(([left], [right]) => left.localeCompare(right)),
  );

  fs.writeFileSync(overridesPath, `${JSON.stringify(sortedOverrides, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote wiki-enriched overrides to ${overridesPath}\n`);
  process.stdout.write(`Updated ${synced} cards from Yu-Gi-Oh Wiki/Fandom.\n`);
};

void syncWikiOverrides();
