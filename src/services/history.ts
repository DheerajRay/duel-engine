import { getSupabaseClient } from '../lib/supabase';
import type { CloudDuelHistoryRow, DuelHistoryEntry } from '../types/cloud';

const DUEL_HISTORY_KEY = 'ygo_duel_history_v1';

const parseHistory = (): DuelHistoryEntry[] => {
  try {
    const raw = localStorage.getItem(DUEL_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as DuelHistoryEntry[]) : [];
  } catch {
    return [];
  }
};

const writeHistory = (entries: DuelHistoryEntry[]) => {
  localStorage.setItem(DUEL_HISTORY_KEY, JSON.stringify(entries));
};

const mergeHistoryEntries = (localEntries: DuelHistoryEntry[], remoteEntries: DuelHistoryEntry[]) => {
  const byId = new Map<string, DuelHistoryEntry>();

  [...localEntries, ...remoteEntries].forEach((entry) => {
    const existing = byId.get(entry.id);
    if (!existing || new Date(entry.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
      byId.set(entry.id, entry);
    }
  });

  return [...byId.values()].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
};

const toCloudRows = (userId: string, entries: DuelHistoryEntry[]): CloudDuelHistoryRow[] =>
  entries.map((entry) => ({
    id: entry.id,
    user_id: userId,
    mode: entry.mode,
    opponent_label: entry.opponentLabel,
    stage_index: entry.stageIndex ?? null,
    result: entry.result,
    turn_count: entry.turnCount,
    lp_remaining: entry.lpRemaining,
    finishing_card: entry.finishingCard,
    notable_play: entry.notablePlay,
    summary: entry.summary,
    logs_payload: entry.logs,
    created_at: entry.createdAt,
  }));

const fromCloudRows = (rows: CloudDuelHistoryRow[]): DuelHistoryEntry[] =>
  rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    opponentLabel: row.opponent_label,
    stageIndex: row.stage_index,
    result: row.result,
    turnCount: row.turn_count,
    lpRemaining: row.lp_remaining,
    finishingCard: row.finishing_card,
    notablePlay: row.notable_play,
    summary: row.summary,
    logs: row.logs_payload,
    createdAt: row.created_at,
  }));

export const getDuelHistory = async (): Promise<DuelHistoryEntry[]> => {
  const localEntries = parseHistory();
  const client = getSupabaseClient();
  if (!client) return localEntries;

  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return localEntries;

  const { data, error } = await client
    .from('duel_history')
    .select('*')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false });

  if (error) return localEntries;

  const merged = mergeHistoryEntries(localEntries, fromCloudRows((data as CloudDuelHistoryRow[]) ?? []));
  writeHistory(merged);
  await client.from('duel_history').upsert(toCloudRows(authData.user.id, merged), { onConflict: 'id' });
  return merged;
};

export const appendDuelHistoryEntry = async (entry: DuelHistoryEntry) => {
  const merged = mergeHistoryEntries(parseHistory(), [entry]);
  writeHistory(merged);

  const client = getSupabaseClient();
  if (!client) return;

  const { data } = await client.auth.getUser();
  if (!data.user) return;

  await client.from('duel_history').upsert(toCloudRows(data.user.id, [entry]), { onConflict: 'id' });
};
