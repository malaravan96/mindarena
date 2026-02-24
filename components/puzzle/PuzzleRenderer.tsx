import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type ExistingAttempt = {
  selected_index: number;
  is_correct: boolean;
  ms_taken: number;
};

type PuzzleData = {
  id: string;
  title: string;
  prompt: string;
  type: string;
  options: string[];
  answer_index: number;
};

type Props = {
  puzzle: PuzzleData;
  onSubmit: (selectedIndex: number) => Promise<void> | void;
  disabled?: boolean;
  existingAttempt?: ExistingAttempt | null;
  elapsed?: number;
  status?: 'idle' | 'correct' | 'wrong';
  submitting?: boolean;
  userRank?: number | null;
  hideTimer?: boolean;
  hideResultNav?: boolean;
  modeLabel?: string;
};

export function PuzzleRenderer({
  puzzle,
  onSubmit,
  disabled,
  existingAttempt,
  elapsed = 0,
  status: externalStatus,
  submitting = false,
  userRank,
  hideTimer,
  hideResultNav,
  modeLabel,
}: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(existingAttempt?.selected_index ?? null);
  const [internalStatus, setInternalStatus] = useState<'idle' | 'correct' | 'wrong'>(
    existingAttempt ? (existingAttempt.is_correct ? 'correct' : 'wrong') : 'idle',
  );
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const status = externalStatus ?? internalStatus;
  const alreadyAnswered = !!existingAttempt || status !== 'idle' || disabled;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.985, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  async function handleSubmit() {
    if (selected === null) return;
    await onSubmit(selected);
  }

  const typeLabel = modeLabel ?? `Daily ${puzzle.type.charAt(0).toUpperCase() + puzzle.type.slice(1)}`;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Card style={styles.challengeCard} padding="lg">
        <View style={styles.challengeMetaRow}>
          <View style={[styles.typePill, { backgroundColor: `${colors.primary}12` }]}>
            <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
            <Text style={[styles.typePillText, { color: colors.primary }]}>{typeLabel}</Text>
          </View>
          {!hideTimer && (
            <View style={[styles.timerPill, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.timerPillText, { color: colors.textSecondary }]}>{elapsed}s</Text>
            </View>
          )}
        </View>

        <Text style={[styles.challengeTitle, { color: colors.text }]}>{puzzle.title}</Text>
        <Text style={[styles.challengePrompt, { color: colors.text }]}>{puzzle.prompt}</Text>

        <View style={styles.optionsWrap}>
          {puzzle.options.map((opt, i) => {
            const active = selected === i;
            const showAnswer = status !== 'idle';
            const isCorrect = i === puzzle.answer_index;
            const isWrong = showAnswer && active && !isCorrect;

            let borderColor = colors.border;
            let bgColor = colors.surface;
            let textColor = colors.text;
            let badgeIcon: 'checkmark-circle' | 'close-circle' | null = null;
            let badgeColor = '';

            if (active && !showAnswer) {
              borderColor = colors.primary;
              bgColor = `${colors.primary}08`;
              textColor = colors.primary;
            }

            if (showAnswer) {
              if (isCorrect) {
                borderColor = colors.correct;
                bgColor = `${colors.correct}10`;
                textColor = colors.correct;
                badgeIcon = 'checkmark-circle';
                badgeColor = colors.correct;
              } else if (isWrong) {
                borderColor = colors.wrong;
                bgColor = `${colors.wrong}10`;
                textColor = colors.wrong;
                badgeIcon = 'close-circle';
                badgeColor = colors.wrong;
              } else {
                textColor = colors.textTertiary;
              }
            }

            return (
              <Pressable
                key={i}
                onPressIn={alreadyAnswered ? undefined : handlePressIn}
                onPressOut={alreadyAnswered ? undefined : handlePressOut}
                onPress={() => !alreadyAnswered && setSelected(i)}
                disabled={alreadyAnswered}
                style={[
                  styles.option,
                  {
                    borderColor,
                    backgroundColor: bgColor,
                    opacity: showAnswer && !isCorrect && !isWrong ? 0.6 : 1,
                  },
                ]}
              >
                <View style={styles.optionContent}>
                  <View
                    style={[
                      styles.optionLetter,
                      {
                        borderColor,
                        backgroundColor:
                          active && !showAnswer
                            ? borderColor
                            : showAnswer && isCorrect
                              ? borderColor
                              : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionLetterText,
                        {
                          color:
                            active && !showAnswer
                              ? '#fff'
                              : showAnswer && isCorrect
                                ? '#fff'
                                : textColor,
                        },
                      ]}
                    >
                      {String.fromCharCode(65 + i)}
                    </Text>
                  </View>
                  <Text style={[styles.optionText, { color: textColor }]}>{opt}</Text>
                </View>
                {badgeIcon && <Ionicons name={badgeIcon} size={22} color={badgeColor} />}
              </Pressable>
            );
          })}
        </View>

        {status === 'idle' && !existingAttempt && !disabled && (
          <Button
            title={submitting ? 'Submitting...' : 'Submit Answer'}
            onPress={handleSubmit}
            disabled={submitting || selected === null}
            loading={submitting}
            variant="gradient"
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        )}

        {status === 'correct' && (
          <View style={[styles.resultCard, { backgroundColor: `${colors.correct}14` }]}>
            <Ionicons name="trophy-outline" size={28} color={colors.correct} />
            <View style={styles.resultTextWrap}>
              <Text style={[styles.resultTitle, { color: colors.correct }]}>Correct answer</Text>
              <Text style={[styles.resultMsg, { color: colors.textSecondary }]}>
                {existingAttempt
                  ? `You solved it in ${(existingAttempt.ms_taken / 1000).toFixed(1)}s`
                  : `Solved in ${elapsed}s`}
                {userRank ? ` - Rank #${userRank}` : ''}
              </Text>
            </View>
            {!hideResultNav && (
              <Pressable onPress={() => router.push('/leaderboard')}>
                <Ionicons name="arrow-forward-circle" size={28} color={colors.correct} />
              </Pressable>
            )}
          </View>
        )}

        {status === 'wrong' && (
          <View style={[styles.resultCard, { backgroundColor: `${colors.wrong}14` }]}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.wrong} />
            <View style={styles.resultTextWrap}>
              <Text style={[styles.resultTitle, { color: colors.wrong }]}>Not quite</Text>
              <Text style={[styles.resultMsg, { color: colors.textSecondary }]}>
                The correct option is highlighted.
              </Text>
            </View>
            {!hideResultNav && (
              <Pressable onPress={() => router.push('/leaderboard')}>
                <Ionicons name="arrow-forward-circle" size={28} color={colors.wrong} />
              </Pressable>
            )}
          </View>
        )}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  challengeCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
  },
  challengeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  typePillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  timerPillText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  challengeTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginBottom: spacing.xs },
  challengePrompt: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * 1.45,
    marginBottom: spacing.lg,
  },
  optionsWrap: { gap: spacing.sm },
  option: {
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  optionLetter: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  optionText: { fontSize: fontSize.base, flex: 1, fontWeight: fontWeight.medium },
  submitBtn: { marginTop: spacing.lg, borderRadius: borderRadius.full },
  resultCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultTextWrap: { flex: 1, minWidth: 0 },
  resultTitle: { fontSize: fontSize.base, fontWeight: fontWeight.black, marginBottom: 2 },
  resultMsg: { fontSize: fontSize.sm },
});
