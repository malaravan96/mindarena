import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { JigsawArtwork as JigsawArtworkCanvas } from '@/components/gameModes/JigsawArtwork';
import { borderRadius, fontSize, fontWeight, isDesktop, spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { showAlert } from '@/lib/alert';
import { formatDuration, type JigsawArtwork, type JigsawGridSize } from '@/lib/gameModes/jigsaw';

type Position = {
  x: number;
  y: number;
};

type Props = {
  puzzleKey: string;
  title: string;
  subtitle: string;
  gridSize: JigsawGridSize;
  artwork?: JigsawArtwork | null;
  imageUri?: string | null;
  competitive: boolean;
  onComplete: (result: { ms: number; moves: number }) => Promise<void> | void;
  onBack: () => void;
};

type PieceProps = {
  pieceId: number;
  correctIndex: number;
  gridSize: number;
  boardSize: number;
  pieceSize: number;
  targetPosition: Position;
  artwork?: JigsawArtwork | null;
  imageUri?: string | null;
  disabled: boolean;
  sessionKey: number;
  onRelease: (pieceId: number, position: Position) => Position;
  onDragStart: () => void;
};

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function DraggableJigsawPiece({
  pieceId,
  correctIndex,
  gridSize,
  boardSize,
  pieceSize,
  targetPosition,
  artwork,
  imageUri,
  disabled,
  sessionKey,
  onRelease,
  onDragStart,
}: PieceProps) {
  const [dragging, setDragging] = useState(false);
  const position = useRef(new Animated.ValueXY(targetPosition)).current;
  const latestPositionRef = useRef(targetPosition);

  useEffect(() => {
    latestPositionRef.current = targetPosition;
    Animated.spring(position, {
      toValue: targetPosition,
      useNativeDriver: false,
      tension: 70,
      friction: 8,
    }).start();
  }, [position, sessionKey, targetPosition]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: () => {
          setDragging(true);
          onDragStart();
        },
        onPanResponderMove: (_event, gestureState) => {
          position.setValue({
            x: latestPositionRef.current.x + gestureState.dx,
            y: latestPositionRef.current.y + gestureState.dy,
          });
        },
        onPanResponderRelease: (_event, gestureState) => {
          const nextPosition = onRelease(pieceId, {
            x: latestPositionRef.current.x + gestureState.dx,
            y: latestPositionRef.current.y + gestureState.dy,
          });
          latestPositionRef.current = nextPosition;
          setDragging(false);
          Animated.spring(position, {
            toValue: nextPosition,
            useNativeDriver: false,
            tension: 80,
            friction: 8,
          }).start();
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          Animated.spring(position, {
            toValue: latestPositionRef.current,
            useNativeDriver: false,
          }).start();
        },
      }),
    [disabled, onDragStart, onRelease, pieceId, position],
  );

  const row = Math.floor(correctIndex / gridSize);
  const col = correctIndex % gridSize;

  return (
    <Animated.View
      {...(!disabled ? panResponder.panHandlers : {})}
      style={[
        styles.piece,
        {
          width: pieceSize,
          height: pieceSize,
          zIndex: dragging ? 50 : 10,
          transform: position.getTranslateTransform(),
        },
      ]}
    >
      <View style={styles.pieceClip}>
        <View
          style={{
            position: 'absolute',
            left: -(col * (boardSize / gridSize)),
            top: -(row * (boardSize / gridSize)),
            width: boardSize,
            height: boardSize,
          }}
        >
          <JigsawArtworkCanvas
            size={boardSize}
            artwork={artwork}
            source={imageUri ? { uri: imageUri } : null}
          />
        </View>
      </View>
      <View style={styles.pieceBadge}>
        <Text style={styles.pieceBadgeText}>{pieceId + 1}</Text>
      </View>
    </Animated.View>
  );
}

export function JigsawBoard({
  puzzleKey,
  title,
  subtitle,
  gridSize,
  artwork,
  imageUri,
  competitive,
  onComplete,
  onBack,
}: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const pieceCount = gridSize * gridSize;
  const baseBoardSize = Math.min(isDesktop ? 440 : width - spacing.xl, 440);
  const cellSize = Math.floor(baseBoardSize / gridSize);
  const boardSize = cellSize * gridSize;
  const pieceInset = 6;
  const pieceSize = cellSize - pieceInset;
  const trayColumns = Math.min(gridSize + 1, 5);
  const trayHeight = Math.ceil(pieceCount / trayColumns) * (pieceSize + spacing.sm);
  const tileIds = useMemo(() => Array.from({ length: pieceCount }, (_, index) => index), [pieceCount]);

  const [sessionKey, setSessionKey] = useState(0);
  const [trayOrder, setTrayOrder] = useState<number[]>([]);
  const [placements, setPlacements] = useState<Record<number, number | null>>({});
  const placementsRef = useRef<Record<number, number | null>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const completionHandledRef = useRef(false);

  const getTrayPosition = useCallback(
    (pieceId: number): Position => {
      const trayIndex = Math.max(0, trayOrder.indexOf(pieceId));
      const col = trayIndex % trayColumns;
      const row = Math.floor(trayIndex / trayColumns);
      const cell = pieceSize + spacing.sm;
      const contentWidth = trayColumns * cell - spacing.sm;
      const leftOffset = Math.max(0, (boardSize - contentWidth) / 2);
      return {
        x: leftOffset + col * cell,
        y: boardSize + spacing.lg + row * cell,
      };
    },
    [boardSize, pieceSize, trayColumns, trayOrder],
  );

  const getSlotPosition = useCallback(
    (slot: number): Position => {
      const col = slot % gridSize;
      const row = Math.floor(slot / gridSize);
      return {
        x: col * cellSize + pieceInset / 2,
        y: row * cellSize + pieceInset / 2,
      };
    },
    [cellSize, gridSize],
  );

  const getTargetPosition = useCallback(
    (pieceId: number) => {
      const slot = placements[pieceId];
      return slot === null || slot === undefined ? getTrayPosition(pieceId) : getSlotPosition(slot);
    },
    [getSlotPosition, getTrayPosition, placements],
  );

  const resetGame = useCallback(() => {
    const shuffled = shuffle(tileIds);
    const nextPlacements = Object.fromEntries(tileIds.map((pieceId) => [pieceId, null])) as Record<number, number | null>;
    placementsRef.current = nextPlacements;
    setTrayOrder(shuffled);
    setPlacements(nextPlacements);
    setStartedAt(null);
    setElapsedMs(0);
    setMoves(0);
    setSaving(false);
    setModalVisible(false);
    completionHandledRef.current = false;
    setSessionKey((value) => value + 1);
  }, [tileIds]);

  useEffect(() => {
    resetGame();
  }, [gridSize, imageUri, puzzleKey, resetGame]);

  useEffect(() => {
    if (!startedAt || modalVisible) return undefined;
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);
    return () => clearInterval(timer);
  }, [modalVisible, startedAt]);

  useEffect(() => {
    const solved = tileIds.every((pieceId) => placements[pieceId] === pieceId);
    if (!solved || completionHandledRef.current) return;

    completionHandledRef.current = true;
    const totalMs = startedAt ? Date.now() - startedAt : 0;
    setElapsedMs(totalMs);
    setSaving(true);
    Promise.resolve(onComplete({ ms: totalMs, moves }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not save your result.';
        showAlert('Save failed', message);
      })
      .finally(() => {
        setSaving(false);
        setModalVisible(true);
      });
  }, [moves, onComplete, placements, startedAt, tileIds]);

  const handleDragStart = useCallback(() => {
    setStartedAt((value) => value ?? Date.now());
  }, []);

  const handleRelease = useCallback(
    (pieceId: number, position: Position) => {
      const centerX = position.x + pieceSize / 2;
      const centerY = position.y + pieceSize / 2;
      const previousSlot = placementsRef.current[pieceId];
      let nextSlot = previousSlot;

      if (centerX >= 0 && centerX <= boardSize && centerY >= 0 && centerY <= boardSize) {
        const col = Math.min(gridSize - 1, Math.max(0, Math.floor(centerX / cellSize)));
        const row = Math.min(gridSize - 1, Math.max(0, Math.floor(centerY / cellSize)));
        const slot = row * gridSize + col;
        const occupiedBy = Object.entries(placementsRef.current).find(
          ([otherPieceId, otherSlot]) => Number(otherPieceId) !== pieceId && otherSlot === slot,
        );
        if (!occupiedBy) {
          nextSlot = slot;
        }
      }

      if (nextSlot !== previousSlot) {
        const updatedPlacements = {
          ...placementsRef.current,
          [pieceId]: nextSlot,
        };
        placementsRef.current = updatedPlacements;
        setPlacements(updatedPlacements);
        setMoves((value) => value + 1);
      }

      return nextSlot === null || nextSlot === undefined
        ? getTrayPosition(pieceId)
        : getSlotPosition(nextSlot);
    },
    [boardSize, cellSize, getSlotPosition, getTrayPosition, gridSize, pieceSize],
  );

  return (
    <>
      <Card padding="lg" style={styles.shell}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          </View>
          <View style={[styles.sizePill, { backgroundColor: `${colors.primary}12` }]}>
            <Text style={[styles.sizePillText, { color: colors.primary }]}>{gridSize} x {gridSize}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{formatDuration(elapsedMs)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="move-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{moves} moves</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons
              name={competitive ? 'trophy-outline' : 'sparkles-outline'}
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {competitive ? 'Ranked' : 'Local'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.playArea,
            {
              width: boardSize,
              height: boardSize + spacing.lg + trayHeight,
            },
          ]}
        >
          <View style={[styles.board, { width: boardSize, height: boardSize, borderColor: colors.border }]}>
            <JigsawArtworkCanvas
              size={boardSize}
              artwork={artwork}
              source={imageUri ? { uri: imageUri } : null}
            />
            <View style={styles.boardOverlay}>
              {tileIds.map((slot) => (
                <View
                  key={slot}
                  style={[
                    styles.slot,
                    {
                      left: (slot % gridSize) * cellSize + pieceInset / 2,
                      top: Math.floor(slot / gridSize) * cellSize + pieceInset / 2,
                      width: pieceSize,
                      height: pieceSize,
                      borderColor: `${colors.background}80`,
                      backgroundColor: `${colors.background}30`,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {tileIds.map((pieceId) => (
            <DraggableJigsawPiece
              key={`${sessionKey}-${pieceId}`}
              pieceId={pieceId}
              correctIndex={pieceId}
              gridSize={gridSize}
              boardSize={boardSize}
              pieceSize={pieceSize}
              targetPosition={getTargetPosition(pieceId)}
              artwork={artwork}
              imageUri={imageUri}
              disabled={modalVisible}
              sessionKey={sessionKey}
              onDragStart={handleDragStart}
              onRelease={handleRelease}
            />
          ))}
        </View>

        <View style={styles.actionsRow}>
          <Button title="Shuffle Again" onPress={resetGame} variant="outline" size="sm" />
          <Button title="Back" onPress={onBack} variant="ghost" size="sm" />
        </View>
      </Card>

      <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <Card padding="lg" style={styles.modalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: `${colors.correct}16` }]}>
              <Ionicons name="checkmark-circle-outline" size={34} color={colors.correct} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Puzzle complete</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {competitive
                ? 'Your best result is now tracked on the in-mode leaderboard.'
                : 'This custom puzzle stays on your device for this session.'}
            </Text>

            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Time</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{formatDuration(elapsedMs)}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Moves</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{moves}</Text>
              </View>
            </View>

            {saving && (
              <Text style={[styles.savingText, { color: colors.textSecondary }]}>Saving result...</Text>
            )}

            <Button title="Play Again" onPress={resetGame} variant="gradient" fullWidth />
            <Pressable onPress={onBack} style={styles.modalLink}>
              <Text style={[styles.modalLinkText, { color: colors.primary }]}>Back to library</Text>
            </Pressable>
          </Card>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: borderRadius.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
  },
  subtitle: {
    marginTop: 4,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.45,
  },
  sizePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  sizePillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    minHeight: 44,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  statValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  playArea: {
    position: 'relative',
    alignSelf: 'center',
  },
  board: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  boardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  slot: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
  },
  piece: {
    position: 'absolute',
  },
  pieceClip: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    backgroundColor: '#ffffff',
  },
  pieceBadge: {
    position: 'absolute',
    right: 4,
    top: 4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: 'rgba(15,23,42,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.black,
  },
  modalSubtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.45,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
  },
  savingText: {
    marginBottom: spacing.sm,
    fontSize: fontSize.xs,
  },
  modalLink: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  modalLinkText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
});
