import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { getCurrentUserId, listMessageTargets } from '@/lib/dm';
import { createGroup } from '@/lib/groupChat';
import { showAlert } from '@/lib/alert';

type Connection = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

export default function CreateGroupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [groupName, setGroupName] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid) return;
      const people = await listMessageTargets(uid);
      setConnections(people);
      setLoading(false);
    })();
  }, []);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onCreate() {
    const name = groupName.trim();
    if (!name) {
      showAlert('Name required', 'Please enter a group name.');
      return;
    }
    if (selected.size < 1) {
      showAlert('Add members', 'Please select at least one member.');
      return;
    }

    setCreating(true);
    try {
      const groupId = await createGroup(name, Array.from(selected));
      router.replace({ pathname: '/group-chat', params: { groupId } });
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to create group');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Group</Text>
        <Pressable
          onPress={onCreate}
          disabled={creating || !groupName.trim() || selected.size === 0}
          style={[
            styles.createBtn,
            {
              backgroundColor:
                creating || !groupName.trim() || selected.size === 0
                  ? colors.border
                  : colors.secondary,
            },
          ]}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Create</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.nameRow, { borderBottomColor: colors.border }]}>
        <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Group name"
          placeholderTextColor={colors.textTertiary}
          style={[styles.nameInput, { color: colors.text }]}
          maxLength={60}
          autoFocus
        />
      </View>

      {selected.size > 0 && (
        <Text style={[styles.selectedHint, { color: colors.textSecondary }]}>
          {selected.size} member{selected.size !== 1 ? 's' : ''} selected
        </Text>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : connections.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No connections to add. Connect with players first.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {connections.map((c) => {
            const name = c.display_name || c.username || 'Player';
            const isSelected = selected.has(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => toggleSelect(c.id)}
                style={[
                  styles.row,
                  {
                    borderColor: isSelected ? colors.secondary : colors.border,
                    backgroundColor: isSelected ? `${colors.secondary}10` : colors.surfaceVariant,
                  },
                ]}
              >
                {c.avatar_url ? (
                  <Image source={{ uri: c.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: `${colors.secondary}16` }]}>
                    <Text style={[styles.avatarText, { color: colors.secondary }]}>
                      {name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {name}
                </Text>
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: isSelected ? colors.secondary : 'transparent',
                      borderColor: isSelected ? colors.secondary : colors.border,
                    },
                  ]}
                >
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  createBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    minWidth: 70,
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  nameInput: { flex: 1, fontSize: fontSize.base },
  selectedHint: {
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { textAlign: 'center', fontSize: fontSize.sm },
  listContent: { padding: spacing.md, gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  name: { flex: 1, fontSize: fontSize.base },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
