import { getSupabaseClient } from '../lib/supabase';
import type {
  CloudCompetitionProgressRow,
  CloudDeckRow,
  CompetitionProgressRecord,
  DeckStorageState,
  SavedDeck,
} from '../types/cloud';
import { generateCuratedDeck } from '../utils/deckGenerator';

const SAVED_DECKS_KEY = 'ygo_saved_decks';
const PRIMARY_DECK_ID_KEY = 'ygo_primary_deck_id';
const PRIMARY_DECK_UPDATED_AT_KEY = 'ygo_primary_deck_updated_at';
const PRIMARY_DECK_MAIN_KEY = 'ygo_custom_deck';
const PRIMARY_DECK_EXTRA_KEY = 'ygo_custom_extra_deck';
const COMPETITION_STAGE_KEY = 'ygo_competition_stage_index';
const COMPETITION_UPDATED_AT_KEY = 'ygo_competition_updated_at';
const STARTER_DECK_ID = 'starter-local';

const nowIso = () => new Date().toISOString();

const parseJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const normalizeDeck = (deck: SavedDeck): SavedDeck => ({
  ...deck,
  kind: deck.kind ?? (deck.isPredefined ? 'character' : 'user'),
  characterId: deck.characterId ?? null,
  updatedAt: deck.updatedAt ?? nowIso(),
  mainDeck: [...deck.mainDeck],
  extraDeck: [...deck.extraDeck],
});

const buildStarterDeck = (): SavedDeck => ({
  id: STARTER_DECK_ID,
  name: 'Starter Deck',
  kind: 'starter',
  characterId: null,
  mainDeck: generateCuratedDeck(),
  extraDeck: [],
  updatedAt: nowIso(),
});

const readLocalDeckState = (): DeckStorageState => {
  const savedDecks = parseJson<SavedDeck[]>(localStorage.getItem(SAVED_DECKS_KEY), []);
  const decks = savedDecks.map(normalizeDeck);

  if (decks.length === 0) {
    const starter = buildStarterDeck();
    const state: DeckStorageState = {
      decks: [starter],
      primaryDeckId: starter.id,
      primaryDeckUpdatedAt: starter.updatedAt!,
    };
    writeLocalDeckState(state);
    return state;
  }

  const primaryDeckId = localStorage.getItem(PRIMARY_DECK_ID_KEY) || decks[0].id;
  const primaryDeck = decks.find((deck) => deck.id === primaryDeckId) ?? decks[0];
  const primaryDeckUpdatedAt = localStorage.getItem(PRIMARY_DECK_UPDATED_AT_KEY) || primaryDeck.updatedAt || nowIso();

  localStorage.setItem(PRIMARY_DECK_ID_KEY, primaryDeck.id);
  localStorage.setItem(PRIMARY_DECK_UPDATED_AT_KEY, primaryDeckUpdatedAt);
  localStorage.setItem(PRIMARY_DECK_MAIN_KEY, JSON.stringify(primaryDeck.mainDeck));
  localStorage.setItem(PRIMARY_DECK_EXTRA_KEY, JSON.stringify(primaryDeck.extraDeck));

  return {
    decks,
    primaryDeckId: primaryDeck.id,
    primaryDeckUpdatedAt,
  };
};

const writeLocalDeckState = (state: DeckStorageState) => {
  const decks = state.decks.map(normalizeDeck);
  localStorage.setItem(SAVED_DECKS_KEY, JSON.stringify(decks));
  if (state.primaryDeckId) {
    localStorage.setItem(PRIMARY_DECK_ID_KEY, state.primaryDeckId);
  }
  localStorage.setItem(PRIMARY_DECK_UPDATED_AT_KEY, state.primaryDeckUpdatedAt);

  const primaryDeck = decks.find((deck) => deck.id === state.primaryDeckId) ?? decks[0];
  if (primaryDeck) {
    localStorage.setItem(PRIMARY_DECK_MAIN_KEY, JSON.stringify(primaryDeck.mainDeck));
    localStorage.setItem(PRIMARY_DECK_EXTRA_KEY, JSON.stringify(primaryDeck.extraDeck));
  }
};

const readLocalCompetitionProgress = (): CompetitionProgressRecord => {
  const currentStageIndex = Number.parseInt(localStorage.getItem(COMPETITION_STAGE_KEY) || '0', 10);
  const updatedAt = localStorage.getItem(COMPETITION_UPDATED_AT_KEY) || nowIso();

  return {
    currentStageIndex: Number.isNaN(currentStageIndex) ? 0 : Math.max(0, currentStageIndex),
    lastClearedStage: Math.max(-1, (Number.isNaN(currentStageIndex) ? 0 : currentStageIndex) - 1),
    updatedAt,
  };
};

const writeLocalCompetitionProgress = (progress: CompetitionProgressRecord) => {
  localStorage.setItem(COMPETITION_STAGE_KEY, String(Math.max(progress.currentStageIndex, 0)));
  localStorage.setItem(COMPETITION_UPDATED_AT_KEY, progress.updatedAt);
};

const toCloudDeckRows = (userId: string, state: DeckStorageState): CloudDeckRow[] =>
  state.decks.map((deck) => ({
    id: deck.id,
    user_id: userId,
    name: deck.name,
    main_deck: deck.mainDeck,
    extra_deck: deck.extraDeck,
    is_primary: deck.id === state.primaryDeckId,
    kind: deck.kind ?? 'user',
    character_id: deck.characterId ?? null,
    updated_at: deck.updatedAt ?? nowIso(),
  }));

const fromCloudDeckRows = (rows: CloudDeckRow[]): DeckStorageState => {
  const decks = rows.map((row) => normalizeDeck({
    id: row.id,
    name: row.name,
    mainDeck: row.main_deck,
    extraDeck: row.extra_deck,
    kind: row.kind,
    characterId: row.character_id,
    updatedAt: row.updated_at,
  }));

  const primaryDeck = rows.find((row) => row.is_primary) ?? rows[0];
  return {
    decks,
    primaryDeckId: primaryDeck?.id ?? decks[0]?.id ?? null,
    primaryDeckUpdatedAt: primaryDeck?.updated_at ?? decks[0]?.updatedAt ?? nowIso(),
  };
};

const mergeDeckStates = (localState: DeckStorageState, remoteState: DeckStorageState): DeckStorageState => {
  const byId = new Map<string, SavedDeck>();

  [...localState.decks, ...remoteState.decks].forEach((deck) => {
    const existing = byId.get(deck.id);
    if (!existing) {
      byId.set(deck.id, normalizeDeck(deck));
      return;
    }

    const existingUpdatedAt = new Date(existing.updatedAt || 0).getTime();
    const candidateUpdatedAt = new Date(deck.updatedAt || 0).getTime();
    if (candidateUpdatedAt >= existingUpdatedAt) {
      byId.set(deck.id, normalizeDeck(deck));
    }
  });

  const decks = [...byId.values()];
  const primaryDeckId =
    new Date(localState.primaryDeckUpdatedAt).getTime() >= new Date(remoteState.primaryDeckUpdatedAt).getTime()
      ? localState.primaryDeckId
      : remoteState.primaryDeckId;

  return {
    decks,
    primaryDeckId: primaryDeckId ?? decks[0]?.id ?? null,
    primaryDeckUpdatedAt: [localState.primaryDeckUpdatedAt, remoteState.primaryDeckUpdatedAt]
      .sort()
      .at(-1) ?? nowIso(),
  };
};

const syncDecksToCloud = async (state: DeckStorageState) => {
  const client = getSupabaseClient();
  if (!client) return;

  const { data } = await client.auth.getUser();
  if (!data.user) return;

  const rows = toCloudDeckRows(data.user.id, state);
  await client.from('user_decks').upsert(rows, { onConflict: 'id' });
};

export const getUserDeckState = async (): Promise<DeckStorageState> => {
  const localState = readLocalDeckState();
  const client = getSupabaseClient();
  if (!client) return localState;

  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return localState;

  const { data, error } = await client
    .from('user_decks')
    .select('*')
    .eq('user_id', authData.user.id)
    .order('updated_at', { ascending: false });

  if (error) return localState;

  const remoteRows = (data as CloudDeckRow[]) ?? [];
  if (remoteRows.length === 0) {
    await syncDecksToCloud(localState);
    return localState;
  }

  const mergedState = mergeDeckStates(localState, fromCloudDeckRows(remoteRows));
  writeLocalDeckState(mergedState);
  await syncDecksToCloud(mergedState);
  return mergedState;
};

export const saveUserDeckState = async (state: DeckStorageState) => {
  const normalizedState: DeckStorageState = {
    ...state,
    decks: state.decks.map(normalizeDeck),
    primaryDeckUpdatedAt: state.primaryDeckUpdatedAt || nowIso(),
  };

  writeLocalDeckState(normalizedState);
  await syncDecksToCloud(normalizedState);
  return normalizedState;
};

export const setPrimaryDeckSelection = async (deckId: string) => {
  const state = await getUserDeckState();
  return saveUserDeckState({
    ...state,
    primaryDeckId: deckId,
    primaryDeckUpdatedAt: nowIso(),
  });
};

export const ensureStarterCustomDeck = async (): Promise<SavedDeck> => {
  const state = await getUserDeckState();
  const primaryDeck = state.decks.find((deck) => deck.id === state.primaryDeckId) ?? state.decks[0];
  if (primaryDeck) {
    return primaryDeck;
  }

  const starterDeck = buildStarterDeck();
  const nextState: DeckStorageState = {
    decks: [starterDeck],
    primaryDeckId: starterDeck.id,
    primaryDeckUpdatedAt: starterDeck.updatedAt || nowIso(),
  };
  await saveUserDeckState(nextState);
  return starterDeck;
};

export const getPrimaryDeckSnapshot = async () => {
  const state = await getUserDeckState();
  const primaryDeck = state.decks.find((deck) => deck.id === state.primaryDeckId) ?? state.decks[0] ?? null;
  return primaryDeck;
};

const syncCompetitionProgressToCloud = async (progress: CompetitionProgressRecord) => {
  const client = getSupabaseClient();
  if (!client) return;

  const { data } = await client.auth.getUser();
  if (!data.user) return;

  const row: CloudCompetitionProgressRow = {
    user_id: data.user.id,
    current_stage_index: progress.currentStageIndex,
    last_cleared_stage: progress.lastClearedStage,
    updated_at: progress.updatedAt,
  };

  await client.from('user_competition_progress').upsert(row, { onConflict: 'user_id' });
};

export const getCompetitionProgress = async (totalStages: number): Promise<CompetitionProgressRecord> => {
  const localProgress = readLocalCompetitionProgress();
  const client = getSupabaseClient();
  if (!client) {
    return {
      ...localProgress,
      currentStageIndex: Math.min(localProgress.currentStageIndex, Math.max(totalStages - 1, 0)),
    };
  }

  const { data: authData } = await client.auth.getUser();
  if (!authData.user) {
    return {
      ...localProgress,
      currentStageIndex: Math.min(localProgress.currentStageIndex, Math.max(totalStages - 1, 0)),
    };
  }

  const { data, error } = await client
    .from('user_competition_progress')
    .select('*')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (error || !data) {
    await syncCompetitionProgressToCloud(localProgress);
    return {
      ...localProgress,
      currentStageIndex: Math.min(localProgress.currentStageIndex, Math.max(totalStages - 1, 0)),
    };
  }

  const remote = data as CloudCompetitionProgressRow;
  const resolved =
    new Date(remote.updated_at).getTime() > new Date(localProgress.updatedAt).getTime()
      ? {
          currentStageIndex: remote.current_stage_index,
          lastClearedStage: remote.last_cleared_stage,
          updatedAt: remote.updated_at,
        }
      : localProgress;

  writeLocalCompetitionProgress(resolved);
  await syncCompetitionProgressToCloud(resolved);
  return {
    ...resolved,
    currentStageIndex: Math.min(resolved.currentStageIndex, Math.max(totalStages - 1, 0)),
  };
};

export const setCompetitionProgress = async (stageIndex: number) => {
  const progress: CompetitionProgressRecord = {
    currentStageIndex: Math.max(stageIndex, 0),
    lastClearedStage: Math.max(stageIndex - 1, -1),
    updatedAt: nowIso(),
  };
  writeLocalCompetitionProgress(progress);
  await syncCompetitionProgressToCloud(progress);
  return progress;
};

export const clearCompetitionProgress = async () => {
  localStorage.removeItem(COMPETITION_STAGE_KEY);
  localStorage.removeItem(COMPETITION_UPDATED_AT_KEY);

  const client = getSupabaseClient();
  if (!client) return;

  const { data } = await client.auth.getUser();
  if (!data.user) return;

  await client.from('user_competition_progress').delete().eq('user_id', data.user.id);
};
