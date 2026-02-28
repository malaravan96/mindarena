import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { createPoll } from '@/lib/polls';
import { showAlert } from '@/lib/alert';

interface PollCreatorSheetProps {
  visible: boolean;
  conversationId?: string;
  groupId?: string;
  onClose: () => void;
  onPollCreated: () => void;
}

export function PollCreatorSheet({
  visible,
  conversationId,
  groupId,
  onClose,
  onPollCreated,
}: PollCreatorSheetProps) {
  const { colors } = useTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [creating, setCreating] = useState(false);

  function reset() {
    setQuestion('');
    setOptions(['', '']);
    setIsMultipleChoice(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function addOption() {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, '']);
  }

  function updateOption(index: number, text: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? text : o)));
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    const q = question.trim();
    if (!q) { showAlert('Missing question', 'Please enter a poll question.'); return; }
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) { showAlert('Not enough options', 'Please enter at least 2 options.'); return; }

    const target = conversationId
      ? { conversationId }
      : groupId
      ? { groupId }
      : null;

    if (!target) { showAlert('Error', 'No conversation target.'); return; }

    setCreating(true);
    try {
      await createPoll(target, q, validOptions, isMultipleChoice);
      reset();
      onPollCreated();
      onClose();
    } catch (e: any) {
      showAlert('Failed', e?.message ?? 'Could not create poll');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.titleRow}>
          <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Create Poll</Text>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.textSecondary }]}>Question</Text>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask a question..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.questionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Options</Text>
          {options.map((opt, i) => (
            <View key={i} style={styles.optionRow}>
              <TextInput
                value={opt}
                onChangeText={(t) => updateOption(i, t)}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor={colors.textTertiary}
                style={[styles.optionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              />
              {options.length > 2 && (
                <Pressable onPress={() => removeOption(i)} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          ))}

          {options.length < 6 && (
            <Pressable
              onPress={addOption}
              style={[styles.addOptionBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="add" size={16} color={colors.textSecondary} />
              <Text style={[styles.addOptionText, { color: colors.textSecondary }]}>Add option</Text>
            </Pressable>
          )}

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Allow multiple choices</Text>
              <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>Voters can pick more than one option</Text>
            </View>
            <Switch
              value={isMultipleChoice}
              onValueChange={setIsMultipleChoice}
              trackColor={{ false: colors.border, true: `${colors.primary}60` }}
              thumbColor={isMultipleChoice ? colors.primary : colors.textTertiary}
            />
          </View>
        </ScrollView>

        <Pressable
          onPress={handleCreate}
          disabled={creating}
          style={[styles.createBtn, { backgroundColor: creating ? colors.border : colors.primary }]}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Create Poll</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  closeBtn: { padding: 4 },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  questionInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  removeBtn: { padding: 4 },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  addOptionText: { fontSize: fontSize.sm },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  toggleSub: { fontSize: fontSize.xs, marginTop: 2 },
  createBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  createBtnText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.sm },
});
