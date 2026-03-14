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
import { borderRadius, fontSize, fontWeight, isDesktop, spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { showAlert } from '@/lib/alert';
import { formatDuration, type PiecesShapeLevel, type ShapePiece } from '@/lib/gameModes/piecesShapePuzzle';

type Position = {
  x: number;
  y: number;
};

type Anchor = {
  x: number;
  y: number;
};

type Props = {
  level: PiecesShapeLevel;
  onComplete: (result: { ms: number; moves: number }) => Promise<void> | void;
  onBack: () => void;
};

type PieceProps = {
  piece: ShapePiece;
  cellSize: number;
  targetPosition: Position;
  disabled: boolean;
  sessionKey: number;
  onDragStart: () => void;
  onRelease: (pieceId: string, position: Position, currentCellSize: number) => Position;
};

function getPieceBounds(piece: ShapePiece) {
  const maxX = Math.max(...piece.cells.map((cell) => cell.x));
  const maxY = Math.max(...piece.cells.map((cell) => cell.y));
  return {
    width: maxX + 1,
    height: maxY + 1,
  };
}

function DraggableShapePiece({
  piece,
  cellSize,
  targetPosition,
  disabled,
  sessionKey,
  onDragStart,
  onRelease,
}: PieceProps) {
  const [dragging, setDragging] = useState(false);
  const position = useRef(new Animated.ValueXY(targetPosition)).current;
  const latestPositionRef = useRef(targetPosition);
  const bounds = useMemo(() => getPieceBounds(piece), [piece]);

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
          const nextPosition = onRelease(
            piece.id,
            {
              x: latestPositionRef.current.x + gestureState.dx,
              y: latestPositionRef.current.y + gestureState.dy,
            },
            cellSize,
          );
          latestPositionRef.current = nextPosition;
          setDragging(false);
          Animated.spring(position, {
            toValue: nextPosition,
            useNativeDriver: false,
            tension: 85,
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
    [cellSize, disabled, onDragStart, onRelease, piece.id, position],
  );

  return (
    <Animated.View
      {...(!disabled ? panResponder.panHandlers : {})}
      style={[
        styles.shapePiece,
        {
          width: bounds.width * cellSize,
          height: bounds.height * cellSize,
          zIndex: dragging ? 60 : 10,
          transform: position.getTranslateTransform(),
        },
      ]}
    >
      {piece.cells.map((cell, index) => (
        <View
          key={`${piece.id}-${index}`}
          style={[
            styles.shapeCell,
            {
              left: cell.x * cellSize,
              top: cell.y * cellSize,
              width: cellSize,
              height: cellSize,
              backgroundColor: piece.color,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

export function PiecesShapeBoard({ level, onComplete, onBack }: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const boardPixelLimit = Math.min(isDesktop ? 420 : width - spacing.xl, 420);
  const boardCellSize = Math.floor(boardPixelLimit / level.boardSize);
  const boardSize = boardCellSize * level.boardSize;
  const trayCellSize = Math.max(18, Math.floor(boardCellSize * 0.62));
  const trayColumns = 2;
  const [sessionKey, setSessionKey] = useState(0);
  const [anchors, setAnchors] = useState<Record<string, Anchor | null>>({});
  const anchorsRef = useRef<Record<string, Anchor | null>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const completionHandledRef = useRef(false);

  const trayPositions = useMemo(() => {
    const positions: Record<string, Position> = {};
    const slotWidth = boardSize / trayColumns;
    level.pieces.forEach((piece, index) => {
      const bounds = getPieceBounds(piece);
      const col = index % trayColumns;
      const row = Math.floor(index / trayColumns);
      const pieceWidth = bounds.width * trayCellSize;
      const pieceHeight = bounds.height * trayCellSize;
      positions[piece.id] = {
        x: col * slotWidth + Math.max(0, (slotWidth - pieceWidth) / 2),
        y: boardSize + spacing.lg + row * (pieceHeight + spacing.lg),
      };
    });
    return positions;
  }, [boardSize, level.pieces, trayCellSize]);

  const totalTrayHeight = useMemo(() => {
    return level.pieces.reduce((height, piece, index) => {
      const bounds = getPieceBounds(piece);
      const row = Math.floor(index / trayColumns);
      const pieceHeight = bounds.height * trayCellSize;
      return Math.max(height, row * (pieceHeight + spacing.lg) + pieceHeight);
    }, 0);
  }, [level.pieces, trayCellSize]);

  const resetLevel = useCallback(() => {
    const nextAnchors = Object.fromEntries(level.pieces.map((piece) => [piece.id, null])) as Record<string, Anchor | null>;
    anchorsRef.current = nextAnchors;
    setAnchors(nextAnchors);
    setStartedAt(null);
    setElapsedMs(0);
    setMoves(0);
    setSaving(false);
    setModalVisible(false);
    completionHandledRef.current = false;
    setSessionKey((value) => value + 1);
  }, [level.pieces]);

  useEffect(() => {
    resetLevel();
  }, [level.levelKey, resetLevel]);

  useEffect(() => {
    if (!startedAt || modalVisible) return undefined;
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);
    return () => clearInterval(timer);
  }, [modalVisible, startedAt]);

  useEffect(() => {
    const allPlaced = level.pieces.every((piece) => anchors[piece.id] !== null);
    if (!allPlaced || completionHandledRef.current) return;

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
  }, [anchors, level.pieces, moves, onComplete, startedAt]);

  const getBoardPosition = useCallback(
    (anchor: Anchor): Position => ({
      x: anchor.x * boardCellSize,
      y: anchor.y * boardCellSize,
    }),
    [boardCellSize],
  );

  const getTargetPosition = useCallback(
    (pieceId: string) => {
      const anchor = anchors[pieceId];
      if (!anchor) return trayPositions[pieceId] ?? { x: 0, y: boardSize + spacing.lg };
      return getBoardPosition(anchor);
    },
    [anchors, boardSize, getBoardPosition, trayPositions],
  );

  const doesPieceFit = useCallback(
    (piece: ShapePiece, anchor: Anchor) => {
      for (const cell of piece.cells) {
        const x = anchor.x + cell.x;
        const y = anchor.y + cell.y;
        if (x < 0 || y < 0 || x >= level.boardSize || y >= level.boardSize) {
          return false;
        }
      }

      for (const otherPiece of level.pieces) {
        if (otherPiece.id === piece.id) continue;
        const otherAnchor = anchorsRef.current[otherPiece.id];
        if (!otherAnchor) continue;

        for (const cell of piece.cells) {
          const absoluteX = anchor.x + cell.x;
          const absoluteY = anchor.y + cell.y;
          const overlaps = otherPiece.cells.some(
            (otherCell) =>
              otherAnchor.x + otherCell.x === absoluteX &&
              otherAnchor.y + otherCell.y === absoluteY,
          );
          if (overlaps) return false;
        }
      }

      return true;
    },
    [level.boardSize, level.pieces],
  );

  const handleDragStart = useCallback(() => {
    setStartedAt((value) => value ?? Date.now());
  }, []);

  const handleRelease = useCallback(
    (pieceId: string, position: Position, currentCellSize: number) => {
      const piece = level.pieces.find((item) => item.id === pieceId);
      if (!piece) return trayPositions[pieceId] ?? { x: 0, y: boardSize + spacing.lg };

      const bounds = getPieceBounds(piece);
      const previousAnchor = anchorsRef.current[pieceId];
      const centerX = position.x + (bounds.width * currentCellSize) / 2;
      const centerY = position.y + (bounds.height * currentCellSize) / 2;
      let nextAnchor = previousAnchor;

      if (centerX >= 0 && centerX <= boardSize && centerY >= 0 && centerY <= boardSize) {
        const candidate = {
          x: Math.round(position.x / boardCellSize),
          y: Math.round(position.y / boardCellSize),
        };
        if (doesPieceFit(piece, candidate)) {
          nextAnchor = candidate;
        }
      }

      const sameAnchor =
        nextAnchor?.x === previousAnchor?.x && nextAnchor?.y === previousAnchor?.y;

      if (!sameAnchor) {
        const nextAnchors = {
          ...anchorsRef.current,
          [pieceId]: nextAnchor,
        };
        anchorsRef.current = nextAnchors;
        setAnchors(nextAnchors);
        setMoves((value) => value + 1);
      }

      return nextAnchor
        ? getBoardPosition(nextAnchor)
        : trayPositions[pieceId] ?? { x: 0, y: boardSize + spacing.lg };
    },
    [boardCellSize, boardSize, doesPieceFit, getBoardPosition, level.pieces, trayPositions],
  );

  return (
    <>
      <Card padding="lg" style={styles.shell}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>{level.title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{level.description}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.primary}12` }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{level.boardSize} x {level.boardSize}</Text>
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
            <Ionicons name="apps-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{level.pieces.length} pieces</Text>
          </View>
        </View>

        <View style={[styles.playArea, { height: boardSize + spacing.lg + totalTrayHeight + spacing.xl }]}>
          <View style={[styles.board, { width: boardSize, height: boardSize, borderColor: colors.border }]}>
            {Array.from({ length: level.boardSize * level.boardSize }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.boardCell,
                  {
                    left: (index % level.boardSize) * boardCellSize,
                    top: Math.floor(index / level.boardSize) * boardCellSize,
                    width: boardCellSize,
                    height: boardCellSize,
                    borderColor: colors.border,
                    backgroundColor: `${colors.primary}08`,
                  },
                ]}
              />
            ))}
          </View>

          {level.pieces.map((piece) => (
            <DraggableShapePiece
              key={`${sessionKey}-${piece.id}`}
              piece={piece}
              cellSize={anchors[piece.id] ? boardCellSize : trayCellSize}
              targetPosition={getTargetPosition(piece.id)}
              disabled={modalVisible}
              sessionKey={sessionKey}
              onDragStart={handleDragStart}
              onRelease={handleRelease}
            />
          ))}
        </View>

        <View style={styles.actionsRow}>
          <Button title="Reset Level" onPress={resetLevel} variant="outline" size="sm" />
          <Button title="Back" onPress={onBack} variant="ghost" size="sm" />
        </View>
      </Card>

      <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <Card padding="lg" style={styles.modalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: `${colors.correct}16` }]}>
              <Ionicons name="extension-puzzle-outline" size={34} color={colors.correct} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Square filled</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Your best result is now tracked for this level.
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

            <Button title="Play Again" onPress={resetLevel} variant="gradient" fullWidth />
            <Pressable onPress={onBack} style={styles.modalLink}>
              <Text style={[styles.modalLinkText, { color: colors.primary }]}>Back to levels</Text>
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
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  badgeText: {
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
    width: '100%',
  },
  board: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  boardCell: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
  },
  shapePiece: {
    position: 'absolute',
  },
  shapeCell: {
    position: 'absolute',
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
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
