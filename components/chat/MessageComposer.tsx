import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, fontSize, fontWeight, borderRadius } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { getItem, setItem } from '@/lib/storage';
import type { DmMessage } from '@/lib/types';

interface MessageComposerProps {
  conversationId: string;
  isBlocked: boolean;
  editingMessage: DmMessage | null;
  replyTarget: DmMessage | null;
  peerName: string;
  userId: string | null;
  androidKbHeight: number;
  onSend: (text: string) => void;
  onSendImage: (uri: string, mime: string, width?: number, height?: number) => void;
  onSendVoice: (uri: string, duration: number) => void;
  onInputChange: (text: string) => void;
  onClearEdit: () => void;
  onClearReply: () => void;
  onOpenEmoji: () => void;
  onOpenPollCreator: () => void;
  onLayout?: (height: number) => void;
}

export function MessageComposer({
  conversationId,
  isBlocked,
  editingMessage,
  replyTarget,
  peerName,
  userId,
  androidKbHeight,
  onSend,
  onSendImage,
  onSendVoice,
  onInputChange,
  onClearEdit,
  onClearReply,
  onOpenEmoji,
  onOpenPollCreator,
  onLayout,
}: MessageComposerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftKey = `chat_draft_${conversationId}`;

  // Load draft
  useEffect(() => {
    let mounted = true;
    setInput('');
    getItem(draftKey).then((raw) => {
      if (!mounted || !raw) return;
      setInput(raw);
    });
    return () => { mounted = false; };
  }, [draftKey]);

  // Save draft with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      void setItem(draftKey, input);
    }, 220);
    return () => clearTimeout(timer);
  }, [draftKey, input]);

  // Populate input when editing
  useEffect(() => {
    if (editingMessage) {
      setInput(editingMessage.body);
    }
  }, [editingMessage]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recording?.stopAndUnloadAsync().catch(() => null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = useCallback(
    (text: string) => {
      setInput(text);
      onInputChange(text);
    },
    [onInputChange],
  );

  const handleSend = useCallback(async () => {
    if (sending) return;
    const body = input.trim();
    if (!body) return;
    setSending(true);
    try {
      onSend(body);
      setInput('');
    } finally {
      setSending(false);
    }
  }, [input, sending, onSend]);

  const pickImage = useCallback(
    async (fromCamera: boolean) => {
      if (isBlocked) return;
      try {
        const result = fromCamera
          ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        onSendImage(asset.uri, asset.mimeType ?? 'image/jpeg', asset.width, asset.height);
      } catch (e: any) {
        showAlert('Failed', e?.message ?? 'Could not send image');
      }
    },
    [isBlocked, onSendImage],
  );

  const startRecording = useCallback(async () => {
    if (isRecording || isBlocked) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission required', 'Microphone access is needed to send voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (e: any) {
      showAlert('Recording failed', e?.message ?? 'Could not start recording');
    }
  }, [isRecording, isBlocked]);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const duration = recordingDuration;
    setIsRecording(false);
    setRecordingDuration(0);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;
      onSendVoice(uri, duration);
    } catch (e: any) {
      showAlert('Failed', e?.message ?? 'Could not send voice message');
    }
  }, [recording, recordingDuration, onSendVoice]);

  const getReplyPreview = (msg: DmMessage) => {
    if (msg.message_type === 'image') return '[Image]';
    if (msg.message_type === 'voice') return '[Voice message]';
    if (msg.message_type === 'file') return '[File]';
    if (msg.message_type === 'video') return '[Video]';
    return msg.body || '';
  };

  return (
    <View>
      {/* Edit bar */}
      {editingMessage && (
        <View
          style={[
            styles.contextBar,
            {
              backgroundColor: `${colors.warning}10`,
              borderTopColor: colors.border,
              borderLeftColor: colors.warning,
            },
          ]}
        >
          <View style={styles.contextBarContent}>
            <Text style={[styles.contextBarName, { color: colors.warning }]} numberOfLines={1}>
              Edit message
            </Text>
            <Text style={[styles.contextBarBody, { color: colors.textSecondary }]} numberOfLines={1}>
              {editingMessage.body}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              onClearEdit();
              setInput('');
            }}
            style={styles.contextBarClose}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Reply bar */}
      {replyTarget && !editingMessage && (
        <View
          style={[
            styles.contextBar,
            {
              backgroundColor: colors.surfaceVariant,
              borderTopColor: colors.border,
              borderLeftColor: colors.primary,
            },
          ]}
        >
          <View style={styles.contextBarContent}>
            <Text style={[styles.contextBarName, { color: colors.primary }]} numberOfLines={1}>
              {replyTarget.sender_id === userId ? 'You' : peerName}
            </Text>
            <Text style={[styles.contextBarBody, { color: colors.textSecondary }]} numberOfLines={1}>
              {getReplyPreview(replyTarget)}
            </Text>
          </View>
          <Pressable onPress={onClearReply} style={styles.contextBarClose}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Composer row */}
      <View
        style={[
          styles.composer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            paddingBottom: androidKbHeight > 0 ? spacing.sm : Math.max(insets.bottom, spacing.sm),
          },
        ]}
        onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
      >
        <Pressable
          onPress={onOpenEmoji}
          disabled={isBlocked}
          style={[
            styles.iconBtn,
            { backgroundColor: `${colors.primary}10`, opacity: isBlocked ? 0.4 : 1 },
          ]}
        >
          <Ionicons name="happy-outline" size={20} color={colors.textSecondary} />
        </Pressable>

        {isRecording ? (
          <View
            style={[
              styles.recordingRow,
              { backgroundColor: `${colors.wrong}14`, borderColor: `${colors.wrong}30` },
            ]}
          >
            <View style={[styles.recordingDot, { backgroundColor: colors.wrong }]} />
            <Text style={[styles.recordingTime, { color: colors.wrong }]}>
              {Math.floor(recordingDuration / 60)}:
              {(recordingDuration % 60).toString().padStart(2, '0')}
            </Text>
            <Pressable
              onPress={stopRecording}
              style={[styles.iconBtn, { backgroundColor: `${colors.wrong}20` }]}
            >
              <Ionicons name="stop" size={18} color={colors.wrong} />
            </Pressable>
          </View>
        ) : (
          <TextInput
            value={input}
            onChangeText={handleInputChange}
            onFocus={() => {/* parent can handle emoji close */}}
            placeholder={isBlocked ? 'Blocked' : 'Type a message...'}
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surfaceVariant,
              },
            ]}
            editable={!sending && !isBlocked}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
          />
        )}

        {!isRecording && !isBlocked && (
          <>
            {!input.trim() ? (
              <>
                <Pressable
                  onPress={() => pickImage(true)}
                  style={[styles.iconBtn, { backgroundColor: `${colors.warning}12` }]}
                  accessibilityRole="button"
                  accessibilityLabel="Open camera"
                >
                  <Ionicons name="camera-outline" size={20} color={colors.warning} />
                </Pressable>
                <Pressable
                  onPress={() => pickImage(false)}
                  style={[styles.iconBtn, { backgroundColor: `${colors.secondary}10` }]}
                  accessibilityRole="button"
                  accessibilityLabel="Send photo from gallery"
                >
                  <Ionicons name="image-outline" size={20} color={colors.secondary} />
                </Pressable>
                <Pressable
                  onPress={startRecording}
                  style={[styles.iconBtn, { backgroundColor: `${colors.wrong}10` }]}
                  accessibilityRole="button"
                  accessibilityLabel="Record voice message"
                >
                  <Ionicons name="mic-outline" size={20} color={colors.wrong} />
                </Pressable>
                <Pressable
                  onPress={onOpenPollCreator}
                  style={[styles.iconBtn, { backgroundColor: `${colors.primary}10` }]}
                  accessibilityRole="button"
                  accessibilityLabel="Create poll"
                >
                  <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => setInput('')}
                style={[styles.iconBtn, { backgroundColor: `${colors.border}70` }]}
                accessibilityRole="button"
                accessibilityLabel="Clear message"
              >
                <Ionicons name="close-outline" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
          </>
        )}

        {!isRecording && (
          <Pressable
            onPress={handleSend}
            disabled={sending || !input.trim() || isBlocked}
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  sending || !input.trim() || isBlocked ? colors.border : colors.primary,
              },
            ]}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderLeftWidth: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  contextBarContent: { flex: 1, gap: 2 },
  contextBarName: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  contextBarBody: { fontSize: fontSize.xs },
  contextBarClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  recordingDot: { width: 8, height: 8, borderRadius: 4 },
  recordingTime: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
