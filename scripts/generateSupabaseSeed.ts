import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import type { Card } from '../src/types';
import { LOCAL_CHARACTER_DECKS } from '../src/utils/characterDecks';
import { COMPETITION_CHARACTERS, COMPETITION_STAGES } from '../src/utils/competitionMode';
import cardOverrides from '../src/resource/card_data_overrides.json';
import { buildCardProvenance, getMissingCardDetailFlags, inferCardSourceType } from '../src/utils/cardDataProfile';

const MIGRATION_FILENAME = '202604121110_refresh_card_content_descriptions.sql';

const escapeSqlString = (value: string) => value.replace(/'/g, "''");

const sqlString = (value: string | null | undefined) =>
  value == null ? 'null' : `'${escapeSqlString(value)}'`;

const sqlInt = (value: number | null | undefined) =>
  value == null ? 'null' : String(value);

const sqlBool = (value: boolean | null | undefined) => {
  if (value == null) return 'null';
  return value ? 'true' : 'false';
};

const sqlTextArray = (values: string[] | null | undefined) => {
  if (!values || values.length === 0) {
    return "ARRAY[]::text[]";
  }

  return `ARRAY[${values.map((value) => sqlString(value)).join(', ')}]::text[]`;
};

const sqlJson = (value: unknown) => `'${escapeSqlString(JSON.stringify(value))}'::jsonb`;

type CardOverrideMap = Record<string, Partial<Card>>;
const overrides = cardOverrides as CardOverrideMap;

const readLocalCards = (): Card[] => {
  const csvPath = path.resolve(process.cwd(), 'src', 'resource', 'original_yugioh_cards.csv');
  const csvData = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csvData, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .filter((row) => row['Card Name'])
    .map((row) => {
      const id = row['Card Name'].toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const override = overrides[id] || {};
      const hasExternalOverride = Object.keys(override).length > 0;
      const type =
        row['Attribute'] === 'SPELL'
          ? 'Spell'
          : row['Attribute'] === 'TRAP'
            ? 'Trap'
            : 'Monster';

      const card: Card = {
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
        const typeSegments = cleanedType.split('/').map((entry) => entry.replace(/\?/g, '').trim()).filter(Boolean);
        card.attribute = row['Attribute'];
        card.level = Number.parseInt(row['Level'] || '0', 10) || 0;
        card.rank = Number.parseInt(row['Rank'] || '0', 10) || undefined;
        card.linkRating = Number.parseInt(row['Link Rating'] || '0', 10) || undefined;
        card.linkArrows = row['Link Arrows']
          ? row['Link Arrows'].split('/').map((entry) => entry.trim()).filter(Boolean)
          : undefined;
        card.pendulumScale = Number.parseInt(row['Pendulum Scale'] || '0', 10) || undefined;
        card.atk = row['ATK'] === '?' ? 0 : Number.parseInt(row['ATK'] || '0', 10) || 0;
        card.def = row['DEF'] === '?' ? 0 : Number.parseInt(row['DEF'] || '0', 10) || 0;
        card.monsterTypeLine = cleanedType || undefined;
        card.monsterRace = typeSegments[0];
        card.monsterAbilities = typeSegments.slice(1);
        card.summoningCondition = row['Summoning Condition'] || undefined;
        card.pendulumEffect = row['Pendulum Effect / Condition'] || undefined;

        if (row['Type']?.includes('Fusion')) {
          card.isFusion = true;
          const condition = row['Summoning Condition'] || row['Lore / Effect / Description'] || '';
          card.fusionMaterials = condition
            .split('+')
            .map((material) => material.replace(/"/g, '').trim())
            .filter(Boolean);
        }
      } else {
        card.subType = (row['Spell/Trap Property'] as Card['subType']) || undefined;
        card.spellTrapProperty = row['Spell/Trap Property'] || undefined;
      }

      card.supports = row['Supports']
        ? row['Supports'].split('/').map((entry) => entry.trim()).filter(Boolean)
        : undefined;
      card.antiSupports = row['Anti-Supports']
        ? row['Anti-Supports'].split('/').map((entry) => entry.trim()).filter(Boolean)
        : undefined;
      card.cardActions = row['Card Actions']
        ? row['Card Actions'].split('/').map((entry) => entry.trim()).filter(Boolean)
        : undefined;
      card.effectTypes = row['Effect Types']
        ? row['Effect Types'].split('/').map((entry) => entry.trim()).filter(Boolean)
        : undefined;

      return {
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
    });
};

const hasSpecialSummonOnlyText = (card: Card) => {
  const description = card.description.toLowerCase();
  return (
    description.includes('cannot be normal summoned/set') ||
    description.includes('cannot be normal summoned or set') ||
    description.includes('must be special summoned') ||
    description.includes('cannot be normal summon') ||
    description.includes('cannot be normal set')
  );
};

const inferSupportMeta = (card: Card) => {
  if (card.type === 'Monster') {
    if (card.isFusion) {
      return { status: 'implemented', note: null } as const;
    }

    if (hasSpecialSummonOnlyText(card)) {
      return {
        status: 'partial',
        note: 'Printed summon restriction is enforced. Monster effect text beyond summon rules is not fully implemented.',
      } as const;
    }

    const effectLikeText = /(once per|special summon|destroy|inflict|draw|banish|tribute|return|negate|cannot|when |if |during )/i;
    return effectLikeText.test(card.description)
      ? ({ status: 'partial', note: null } as const)
      : ({ status: 'implemented', note: null } as const);
  }

  return {
    status: 'unsupported',
    note: `${card.type} effect is not implemented yet.`,
  } as const;
};

const deriveEngineBehaviorKey = (card: Card, supportMeta: ReturnType<typeof inferSupportMeta>) => {
  return supportMeta.status !== 'unsupported' ? card.id : null;
};

const deriveRequiresManualTargeting = (card: Card) => {
  const description = card.description.toLowerCase();
  return (
    description.includes('target ') ||
    (card.cardActions ?? []).some((action) => /target/i.test(action))
  );
};

const deriveHiddenInformationImpact = (card: Card) => {
  const abilities = (card.monsterAbilities ?? []).map((entry) => entry.toLowerCase());
  const description = card.description.toLowerCase();
  return abilities.includes('flip') || description.includes('face-down') || description.includes('set ');
};

const deriveAiPriorityWeight = (card: Card, supportMeta: ReturnType<typeof inferSupportMeta>) => {
  if (supportMeta.status === 'unsupported') return 0;

  let weight = 0;
  if (card.type === 'Monster') {
    weight += Math.max(0, Math.floor((card.atk ?? 0) / 500));
    if (card.isFusion) weight += 3;
  }

  if (/destroy all/i.test(card.description)) weight += 6;
  if (/destroy/i.test(card.description)) weight += 3;
  if (/draw/i.test(card.description)) weight += 2;
  if (/special summon/i.test(card.description)) weight += 3;

  return weight;
};

const sortCards = (left: Card, right: Card) =>
  (right.atk ?? 0) - (left.atk ?? 0) ||
  (right.level ?? 0) - (left.level ?? 0) ||
  left.name.localeCompare(right.name) ||
  left.id.localeCompare(right.id);

const buildDeterministicStarterDeck = (cards: Card[]) => {
  const deck: string[] = [];
  const counts = new Map<string, number>();

  const addCard = (cardId: string) => {
    const current = counts.get(cardId) ?? 0;
    if (current >= 3 || deck.length >= 40) return false;
    counts.set(cardId, current + 1);
    deck.push(cardId);
    return true;
  };

  const addFromPool = (pool: Card[], targetCount: number) => {
    if (pool.length === 0 || targetCount <= 0) return;
    let index = 0;
    let safety = 0;

    while (deck.length < 40 && targetCount > 0 && safety < 5000) {
      const card = pool[index % pool.length];
      if (addCard(card.id)) {
        targetCount -= 1;
      }
      index += 1;
      safety += 1;
      if (pool.every((entry) => (counts.get(entry.id) ?? 0) >= 3)) {
        break;
      }
    }
  };

  const nonFusionMonsters = cards.filter((card) => card.type === 'Monster' && !card.isFusion && (card.atk ?? 0) > 0);
  const lowMonsters = nonFusionMonsters.filter((card) => (card.level ?? 0) <= 4).sort(sortCards).slice(0, 30);
  const highMonsters = nonFusionMonsters.filter((card) => (card.level ?? 0) >= 5).sort(sortCards).slice(0, 15);

  const implementedSpellIds = [
    'dark-hole',
    'raigeki',
    'fissure',
    'hinotama',
    'pot-of-greed',
    'tribute-to-the-doomed',
    'monster-reborn',
    'polymerization',
    'brain-control',
    'de-spell',
    'harpie-s-feather-duster',
  ];
  const implementedTrapIds = [
    'dust-tornado',
    'trap-hole',
    'mirror-force',
    'magic-cylinder',
    'negate-attack',
  ];
  const staples = [
    'pot-of-greed',
    'monster-reborn',
    'dark-hole',
    'raigeki',
    'tribute-to-the-doomed',
    'fissure',
    'brain-control',
    'de-spell',
    'harpie-s-feather-duster',
    'trap-hole',
    'mirror-force',
    'magic-cylinder',
    'negate-attack',
    'dust-tornado',
    'polymerization',
  ];

  addFromPool(lowMonsters, 18);
  addFromPool(highMonsters, 6);

  staples.forEach((cardId) => {
    if (cards.some((card) => card.id === cardId)) {
      addCard(cardId);
    }
  });

  const spells = cards
    .filter((card) => card.type === 'Spell' && implementedSpellIds.includes(card.id))
    .sort((left, right) => left.name.localeCompare(right.name));
  const traps = cards
    .filter((card) => card.type === 'Trap' && implementedTrapIds.includes(card.id))
    .sort((left, right) => left.name.localeCompare(right.name));

  addFromPool(spells, deck.length < 40 ? Math.floor((40 - deck.length) * 0.6) : 0);
  addFromPool(traps, 40 - deck.length);
  addFromPool(cards.filter((card) => !card.isFusion).sort(sortCards), 40 - deck.length);

  return deck.slice(0, 40);
};

const buildMigrationSql = () => {
  const cards = readLocalCards();
  const starterDeck = {
    id: 'starter_deck',
    name: 'Starter Deck',
    kind: 'starter' as const,
    mainDeck: buildDeterministicStarterDeck(cards),
    extraDeck: [] as string[],
    characterId: null,
  };

  const cardValues = cards.map((card) => {
    const supportMeta = inferSupportMeta(card);
    return `(${[
      sqlString(card.id),
      sqlString(card.name),
      sqlString(card.type),
      sqlString(card.description),
      sqlString(card.sourceType ?? null),
      sqlString(card.textSource ?? null),
      sqlString(card.verificationStatus ?? null),
      card.lastVerifiedAt ? sqlString(card.lastVerifiedAt) : "timezone('utc', now())",
      sqlString(card.notes ?? null),
      sqlInt(card.originalPage ?? null),
      sqlBool(card.matchedSnapshot ?? null),
      sqlString(card.passcode ?? null),
      sqlString(card.cardStatus ?? null),
      sqlString(card.attribute ?? null),
      sqlInt(card.level ?? null),
      sqlInt(card.rank ?? null),
      sqlInt(card.linkRating ?? null),
      sqlTextArray(card.linkArrows ?? []),
      sqlInt(card.pendulumScale ?? null),
      sqlInt(card.atk ?? null),
      sqlInt(card.def ?? null),
      sqlString(card.subType ?? null),
      sqlString(card.monsterTypeLine ?? null),
      sqlString(card.monsterRace ?? null),
      sqlTextArray(card.monsterAbilities ?? []),
      sqlString(card.spellTrapProperty ?? null),
      sqlBool(card.isFusion ?? false),
      sqlTextArray(card.fusionMaterials ?? []),
      sqlString(card.summoningCondition ?? null),
      sqlString(card.pendulumEffect ?? null),
      sqlTextArray(card.supports ?? []),
      sqlTextArray(card.antiSupports ?? []),
      sqlTextArray(card.cardActions ?? []),
      sqlTextArray(card.effectTypes ?? []),
      sqlString(supportMeta.status),
      sqlString(supportMeta.note),
    ].join(', ')})`;
  });

  const engineMetadataValues = cards.map((card) => {
    const supportMeta = inferSupportMeta(card);
    return `(${[
      sqlString(card.id),
      sqlString(supportMeta.status),
      sqlString(supportMeta.note),
      sqlString(deriveEngineBehaviorKey(card, supportMeta)),
      sqlBool(true),
      sqlBool(deriveRequiresManualTargeting(card)),
      sqlBool(deriveHiddenInformationImpact(card)),
      sqlInt(deriveAiPriorityWeight(card, supportMeta)),
    ].join(', ')})`;
  });

  const reviewQueueEntries = cards
    .map((card) => {
      const flags = getMissingCardDetailFlags(card);
      if (!flags.missingDescription && !flags.missingPasscode && !flags.missingMonsterTypeLine) {
        return null;
      }

      return {
        cardId: card.id,
        missingDescription: flags.missingDescription,
        missingPasscode: flags.missingPasscode,
        missingMonsterTypeLine: flags.missingMonsterTypeLine,
        suggestedSourceType: inferCardSourceType(card),
        reviewStatus: 'needs_review' as const,
        reviewNotes: card.notes ?? 'Needs manual card data review.',
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const reviewQueueValues = reviewQueueEntries.map((entry) => `(${[
    sqlString(entry.cardId),
    sqlBool(entry.missingDescription),
    sqlBool(entry.missingPasscode),
    sqlBool(entry.missingMonsterTypeLine),
    sqlString(entry.suggestedSourceType),
    sqlString(entry.reviewStatus),
    sqlString(entry.reviewNotes),
  ].join(', ')})`);

  const characterValues = COMPETITION_CHARACTERS.map((character) => `(${[
    sqlString(character.id),
    sqlString(character.name),
    sqlString(character.introLine),
    sqlString(character.forfeitLine),
    sqlString(character.stageClearLine),
    sqlString(character.defeatLine),
    sqlTextArray(character.signatureCardIds),
    sqlJson(character.aiProfile),
    sqlJson(character.voice),
  ].join(', ')})`);

  const deckValues = [starterDeck, ...LOCAL_CHARACTER_DECKS.map((deck) => ({
    id: deck.id,
    name: deck.name,
    kind: (deck.kind === 'starter' ? 'starter' : 'character') as 'starter' | 'character',
    mainDeck: deck.mainDeck,
    extraDeck: deck.extraDeck,
    characterId: deck.characterId ?? deck.id,
  }))].map((deck) => `(${[
    sqlString(deck.id),
    sqlString(deck.name),
    sqlString(deck.kind),
    sqlTextArray(deck.mainDeck),
    sqlTextArray(deck.extraDeck),
    sqlString(deck.characterId),
  ].join(', ')})`);

  const stageValues = COMPETITION_STAGES.map((stage) => `(${[
    sqlInt(stage.stageNumber),
    sqlString(stage.characterId),
    sqlInt(stage.summaryOrder),
  ].join(', ')})`);

  return `-- Generated by scripts/generateSupabaseSeed.ts
-- Seeds core game content from the local catalog into Supabase.

insert into public.cards (
  id,
  name,
  type,
  description,
  source_type,
  text_source,
  verification_status,
  last_verified_at,
  notes,
  original_page,
  matched_snapshot,
  passcode,
  card_status,
  attribute,
  level,
  rank,
  link_rating,
  link_arrows,
  pendulum_scale,
  atk,
  def,
  sub_type,
  monster_type_line,
  monster_race,
  monster_abilities,
  spell_trap_property,
  is_fusion,
  fusion_materials,
  summoning_condition,
  pendulum_effect,
  support_tags,
  anti_support_tags,
  card_actions,
  effect_types,
  effect_support_status,
  effect_support_note
)
values
${cardValues.join(',\n')}
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  description = excluded.description,
  source_type = excluded.source_type,
  text_source = excluded.text_source,
  verification_status = excluded.verification_status,
  last_verified_at = excluded.last_verified_at,
  notes = excluded.notes,
  original_page = excluded.original_page,
  matched_snapshot = excluded.matched_snapshot,
  passcode = excluded.passcode,
  card_status = excluded.card_status,
  attribute = excluded.attribute,
  level = excluded.level,
  rank = excluded.rank,
  link_rating = excluded.link_rating,
  link_arrows = excluded.link_arrows,
  pendulum_scale = excluded.pendulum_scale,
  atk = excluded.atk,
  def = excluded.def,
  sub_type = excluded.sub_type,
  monster_type_line = excluded.monster_type_line,
  monster_race = excluded.monster_race,
  monster_abilities = excluded.monster_abilities,
  spell_trap_property = excluded.spell_trap_property,
  is_fusion = excluded.is_fusion,
  fusion_materials = excluded.fusion_materials,
  summoning_condition = excluded.summoning_condition,
  pendulum_effect = excluded.pendulum_effect,
  support_tags = excluded.support_tags,
  anti_support_tags = excluded.anti_support_tags,
  card_actions = excluded.card_actions,
  effect_types = excluded.effect_types,
  effect_support_status = excluded.effect_support_status,
  effect_support_note = excluded.effect_support_note,
  updated_at = timezone('utc', now());

insert into public.card_engine_metadata (
  card_id,
  effect_support_status,
  effect_support_note,
  engine_behavior_key,
  is_playable_in_engine,
  requires_manual_targeting,
  has_hidden_information_impact,
  ai_priority_weight
)
values
${engineMetadataValues.join(',\n')}
on conflict (card_id) do update set
  effect_support_status = excluded.effect_support_status,
  effect_support_note = excluded.effect_support_note,
  engine_behavior_key = excluded.engine_behavior_key,
  is_playable_in_engine = excluded.is_playable_in_engine,
  requires_manual_targeting = excluded.requires_manual_targeting,
  has_hidden_information_impact = excluded.has_hidden_information_impact,
  ai_priority_weight = excluded.ai_priority_weight,
  updated_at = timezone('utc', now());

${reviewQueueValues.length > 0 ? `insert into public.card_review_queue (
  card_id,
  missing_description,
  missing_passcode,
  missing_monster_type_line,
  suggested_source_type,
  review_status,
  review_notes
)
values
${reviewQueueValues.join(',\n')}
on conflict (card_id) do update set
  missing_description = excluded.missing_description,
  missing_passcode = excluded.missing_passcode,
  missing_monster_type_line = excluded.missing_monster_type_line,
  suggested_source_type = excluded.suggested_source_type,
  review_status = excluded.review_status,
  review_notes = excluded.review_notes,
  updated_at = timezone('utc', now());

delete from public.card_review_queue
where card_id not in (${reviewQueueEntries
  .map((entry) => sqlString(entry.cardId))
  .join(', ')});` : ''}

insert into public.characters (
  id,
  name,
  intro_line,
  forfeit_line,
  stage_clear_line,
  defeat_line,
  signature_card_ids,
  ai_profile,
  voice_profile
)
values
${characterValues.join(',\n')}
on conflict (id) do update set
  name = excluded.name,
  intro_line = excluded.intro_line,
  forfeit_line = excluded.forfeit_line,
  stage_clear_line = excluded.stage_clear_line,
  defeat_line = excluded.defeat_line,
  signature_card_ids = excluded.signature_card_ids,
  ai_profile = excluded.ai_profile,
  voice_profile = excluded.voice_profile,
  updated_at = timezone('utc', now());

insert into public.predefined_decks (
  id,
  name,
  kind,
  main_deck,
  extra_deck,
  character_id
)
values
${deckValues.join(',\n')}
on conflict (id) do update set
  name = excluded.name,
  kind = excluded.kind,
  main_deck = excluded.main_deck,
  extra_deck = excluded.extra_deck,
  character_id = excluded.character_id,
  updated_at = timezone('utc', now());

insert into public.competition_stages (
  stage_number,
  character_id,
  summary_order
)
values
${stageValues.join(',\n')}
on conflict (stage_number) do update set
  character_id = excluded.character_id,
  summary_order = excluded.summary_order;
`;
};

const migrationSql = buildMigrationSql();
const migrationPath = path.resolve(process.cwd(), 'supabase', 'migrations', MIGRATION_FILENAME);
fs.writeFileSync(migrationPath, migrationSql, 'utf8');
console.log(`Generated ${migrationPath}`);
