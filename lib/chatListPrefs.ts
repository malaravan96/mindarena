import { supabase } from '@/lib/supabase';

export type ChatListPrefs = {
  pinnedDmIds: string[];
  mutedDmIds: string[];
  archivedDmIds: string[];
  pinnedGroupIds: string[];
  mutedGroupIds: string[];
  archivedGroupIds: string[];
};

export const DEFAULT_CHAT_LIST_PREFS: ChatListPrefs = {
  pinnedDmIds: [],
  mutedDmIds: [],
  archivedDmIds: [],
  pinnedGroupIds: [],
  mutedGroupIds: [],
  archivedGroupIds: [],
};

type ChatListPrefsRow = {
  user_id: string;
  pinned_dm_ids: string[] | null;
  muted_dm_ids: string[] | null;
  archived_dm_ids: string[] | null;
  pinned_group_ids: string[] | null;
  muted_group_ids: string[] | null;
  archived_group_ids: string[] | null;
  updated_at: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (UUID_RE.test(trimmed)) {
        unique.add(trimmed);
      }
    }
  }
  return Array.from(unique);
}

function normalizePrefs(input: Partial<ChatListPrefs> | null | undefined): ChatListPrefs {
  return {
    pinnedDmIds: normalizeIds(input?.pinnedDmIds),
    mutedDmIds: normalizeIds(input?.mutedDmIds),
    archivedDmIds: normalizeIds(input?.archivedDmIds),
    pinnedGroupIds: normalizeIds(input?.pinnedGroupIds),
    mutedGroupIds: normalizeIds(input?.mutedGroupIds),
    archivedGroupIds: normalizeIds(input?.archivedGroupIds),
  };
}

function fromRow(row: ChatListPrefsRow): ChatListPrefs {
  return normalizePrefs({
    pinnedDmIds: row.pinned_dm_ids ?? [],
    mutedDmIds: row.muted_dm_ids ?? [],
    archivedDmIds: row.archived_dm_ids ?? [],
    pinnedGroupIds: row.pinned_group_ids ?? [],
    mutedGroupIds: row.muted_group_ids ?? [],
    archivedGroupIds: row.archived_group_ids ?? [],
  });
}

function toRow(userId: string, prefs: ChatListPrefs): Omit<ChatListPrefsRow, 'updated_at'> & { updated_at: string } {
  const normalized = normalizePrefs(prefs);
  return {
    user_id: userId,
    pinned_dm_ids: normalized.pinnedDmIds,
    muted_dm_ids: normalized.mutedDmIds,
    archived_dm_ids: normalized.archivedDmIds,
    pinned_group_ids: normalized.pinnedGroupIds,
    muted_group_ids: normalized.mutedGroupIds,
    archived_group_ids: normalized.archivedGroupIds,
    updated_at: new Date().toISOString(),
  };
}

export function parseChatListPrefs(raw: string | null): ChatListPrefs {
  if (!raw) return DEFAULT_CHAT_LIST_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<ChatListPrefs>;
    return normalizePrefs(parsed);
  } catch {
    return DEFAULT_CHAT_LIST_PREFS;
  }
}

export function hasChatListPrefsValues(prefs: ChatListPrefs): boolean {
  return (
    prefs.pinnedDmIds.length > 0 ||
    prefs.mutedDmIds.length > 0 ||
    prefs.archivedDmIds.length > 0 ||
    prefs.pinnedGroupIds.length > 0 ||
    prefs.mutedGroupIds.length > 0 ||
    prefs.archivedGroupIds.length > 0
  );
}

export async function readChatListPrefs(userId: string): Promise<ChatListPrefs | null> {
  const { data, error } = await supabase
    .from('chat_list_preferences')
    .select(
      'user_id, pinned_dm_ids, muted_dm_ids, archived_dm_ids, pinned_group_ids, muted_group_ids, archived_group_ids, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle<ChatListPrefsRow>();

  if (error) throw error;
  if (!data) return null;
  return fromRow(data);
}

const saveQueues = new Map<string, Promise<void>>();

export function queueChatListPrefsSave(userId: string, prefs: ChatListPrefs): Promise<void> {
  const previous = saveQueues.get(userId) ?? Promise.resolve();

  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const { error } = await supabase
        .from('chat_list_preferences')
        .upsert(toRow(userId, prefs), { onConflict: 'user_id' });
      if (error) throw error;
    });

  saveQueues.set(userId, next);
  return next.finally(() => {
    if (saveQueues.get(userId) === next) {
      saveQueues.delete(userId);
    }
  });
}
