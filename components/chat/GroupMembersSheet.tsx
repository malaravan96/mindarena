import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import {
  addGroupMember,
  deleteGroup,
  leaveGroup,
  listGroupMembers,
  promoteGroupMember,
  removeGroupMember,
} from '@/lib/groupChat';
import { showAlert, showConfirm } from '@/lib/alert';
import type { GroupMember, GroupRole } from '@/lib/types';

interface GroupMembersSheetProps {
  visible: boolean;
  groupId: string;
  groupName: string;
  currentUserId: string | null;
  onClose: () => void;
  onGroupDeleted: () => void;
}

const ROLE_LABEL: Record<GroupRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export function GroupMembersSheet({
  visible,
  groupId,
  groupName,
  currentUserId,
  onClose,
  onGroupDeleted,
}: GroupMembersSheetProps) {
  const { colors } = useTheme();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const myRole = members.find((m) => m.user_id === currentUserId)?.role ?? 'member';
  const canManage = myRole === 'owner' || myRole === 'admin';

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await listGroupMembers(groupId);
      setMembers(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) reload().catch(() => null);
  }, [visible, groupId]);

  async function handleRemove(member: GroupMember) {
    const name = member.profile?.display_name || member.profile?.username || 'this member';
    const confirmed = await showConfirm('Remove Member', `Remove ${name} from the group?`, 'Remove');
    if (!confirmed) return;
    try {
      await removeGroupMember(groupId, member.user_id);
      await reload();
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to remove member');
    }
  }

  async function handlePromote(member: GroupMember, newRole: GroupRole) {
    try {
      await promoteGroupMember(groupId, member.user_id, newRole);
      await reload();
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to update role');
    }
  }

  async function handleLeave() {
    const confirmed = await showConfirm('Leave Group', `Leave "${groupName}"?`, 'Leave');
    if (!confirmed) return;
    try {
      await leaveGroup(groupId);
      onClose();
      onGroupDeleted();
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to leave group');
    }
  }

  async function handleDelete() {
    const confirmed = await showConfirm(
      'Delete Group',
      `Permanently delete "${groupName}"? This cannot be undone.`,
      'Delete',
    );
    if (!confirmed) return;
    try {
      await deleteGroup(groupId);
      onClose();
      onGroupDeleted();
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to delete group');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <Text style={[styles.title, { color: colors.text }]}>{groupName}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.memberList}>
            {members.map((member) => {
              const name = member.profile?.display_name || member.profile?.username || 'Player';
              const avatarUrl = member.profile?.avatar_url;
              const isMe = member.user_id === currentUserId;

              return (
                <View key={member.user_id} style={[styles.memberRow, { borderColor: colors.border }]}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: `${colors.primary}16` }]}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                      {name} {isMe ? '(you)' : ''}
                    </Text>
                    <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                      {ROLE_LABEL[member.role]}
                    </Text>
                  </View>

                  {canManage && !isMe && member.role !== 'owner' && (
                    <View style={styles.actions}>
                      {member.role === 'member' && myRole === 'owner' && (
                        <Pressable
                          onPress={() => handlePromote(member, 'admin')}
                          style={[styles.actionBtn, { backgroundColor: `${colors.primary}14` }]}
                          hitSlop={8}
                        >
                          <Ionicons name="arrow-up" size={14} color={colors.primary} />
                        </Pressable>
                      )}
                      {member.role === 'admin' && myRole === 'owner' && (
                        <Pressable
                          onPress={() => handlePromote(member, 'member')}
                          style={[styles.actionBtn, { backgroundColor: `${colors.warning}14` }]}
                          hitSlop={8}
                        >
                          <Ionicons name="arrow-down" size={14} color={colors.warning} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => handleRemove(member)}
                        style={[styles.actionBtn, { backgroundColor: `${colors.wrong}14` }]}
                        hitSlop={8}
                      >
                        <Ionicons name="remove-circle-outline" size={14} color={colors.wrong} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <Pressable
            onPress={handleLeave}
            style={[styles.footerBtn, { backgroundColor: `${colors.warning}14`, borderColor: `${colors.warning}30` }]}
          >
            <Ionicons name="exit-outline" size={16} color={colors.warning} />
            <Text style={[styles.footerBtnText, { color: colors.warning }]}>Leave Group</Text>
          </Pressable>
          {myRole === 'owner' && (
            <Pressable
              onPress={handleDelete}
              style={[styles.footerBtn, { backgroundColor: `${colors.wrong}14`, borderColor: `${colors.wrong}30` }]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.wrong} />
              <Text style={[styles.footerBtnText, { color: colors.wrong }]}>Delete Group</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  subtitle: { fontSize: fontSize.sm, marginTop: 2 },
  memberList: { paddingHorizontal: spacing.md },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  memberInfo: { flex: 1 },
  memberName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  memberRole: { fontSize: fontSize.xs, marginTop: 1 },
  actions: { flexDirection: 'row', gap: spacing.xs },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
  },
  footerBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
