import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ImageBackground,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  FlatList,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useGlobalNotifications } from '@/contexts/GlobalNotificationsContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import {
  getCurrentUserId,
  markConversationRead,
  sendMessage,
  editDmMessage,
  deleteDmMessage,
  pinDmMessage,
  unpinDmMessage,
} from '@/lib/dm';
import { toggleReaction, broadcastReaction, loadReactionsForMessages, groupReactions } from '@/lib/dmReactions';
import { blockUser, unblockUser, isBlocked as checkIsBlocked } from '@/lib/connections';
import { ensureDmE2eeReady } from '@/lib/dmE2ee';
import { setActiveConversationId as setActiveConversationIdGlobal } from '@/lib/notificationState';
import { supabase } from '@/lib/supabase';
import { showAlert, showConfirm } from '@/lib/alert';
import { getItem, setItem } from '@/lib/storage';
import { getConversationSettings, setDisappearingMessages } from '@/lib/dmSettings';
import { reportUser, type ReportReason } from '@/lib/report';
import { sendImageMessage, sendVoiceMessage } from '@/lib/dmAttachments';
import type { DmMessage } from '@/lib/types';
import * as ImagePicker from 'expo-image-picker';

import { useChatRealtime } from '@/hooks/useChatRealtime';
import { useCallSession } from '@/hooks/useCallSession';

import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { MessageList } from '@/components/chat/MessageList';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { FullScreenCallOverlay } from '@/components/chat/FullScreenCallOverlay';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { ReactionPicker } from '@/components/chat/ReactionPicker';
import { ScreenshotWarningBanner } from '@/components/chat/ScreenshotWarningBanner';
import { MessageActionMenu } from '@/components/chat/MessageActionMenu';
import { PinnedMessagesSheet } from '@/components/chat/PinnedMessagesSheet';
import { ForwardMessageSheet } from '@/components/chat/ForwardMessageSheet';
import { PollCreatorSheet } from '@/components/chat/PollCreatorSheet';
import { MessageSearchSheet } from '@/components/chat/MessageSearchSheet';

export function ChatThreadScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { colors } = useTheme();
  const { setActiveConversationId, consumePendingIncomingInvite } = useGlobalNotifications();

  // ── Core state ──
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selfName, setSelfName] = useState('Player');
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState('Player');
  const [peerAvatarUrl, setPeerAvatarUrl] = useState<string | null>(null);
  const [isBlockedState, setIsBlockedState] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [disappearingTtl, setDisappearingTtl] = useState<number | null>(null);

  // ── Modal state ──
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDisappearingModal, setShowDisappearingModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('spam');
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<DmMessage | null>(null);
  const [actionMenuMessage, setActionMenuMessage] = useState<DmMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<DmMessage | null>(null);
  const [showPinnedSheet, setShowPinnedSheet] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<DmMessage | null>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [chatWallpaper, setChatWallpaper] = useState<{ type: 'color' | 'image'; value: string } | null>(null);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

  // ── Layout state ──
  const [composerHeight, setComposerHeight] = useState(56);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [androidKbHeight, setAndroidKbHeight] = useState(0);

  const messageListRef = useRef<FlatList | null>(null);
  const shouldAutoScrollRef = useRef(true);

  // ── Extracted hooks ──

  const chatRealtime = useChatRealtime({
    conversationId,
    userId,
    peerId,
  });

  const callSession = useCallSession({
    conversationId,
    userId,
    peerId,
    selfName,
    peerName,
    peerAvatarUrl,
    callChannel: chatRealtime.callChannel,
    consumePendingIncomingInvite,
  });

  // ── Conversation suppression ──
  useEffect(() => {
    if (!conversationId) return;
    setActiveConversationId(conversationId);
    setActiveConversationIdGlobal(conversationId);
    return () => {
      setActiveConversationId(null);
      setActiveConversationIdGlobal(null);
    };
  }, [conversationId, setActiveConversationId]);

  // ── Load wallpaper ──
  useEffect(() => {
    if (!conversationId) return;
    getItem(`chat_wallpaper_${conversationId}`).then((raw) => {
      if (!raw) return;
      try { setChatWallpaper(JSON.parse(raw)); } catch { /* ignore */ }
    });
  }, [conversationId]);

  // ── Load thread ──
  const loadThread = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const uid = await getCurrentUserId();
      setUserId(uid);
      if (!uid) return;

      await ensureDmE2eeReady(uid).catch(() => null);

      const [{ data: me }, { data: conversation }] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', uid)
          .maybeSingle<{ display_name: string | null; username: string | null }>(),
        supabase
          .from('dm_conversations')
          .select('user_a, user_b')
          .eq('id', conversationId)
          .maybeSingle<{ user_a: string; user_b: string }>(),
      ]);

      setSelfName(me?.display_name || me?.username || 'Player');
      if (!conversation) return;

      const nextPeerId = conversation.user_a === uid ? conversation.user_b : conversation.user_a;
      setPeerId(nextPeerId);

      const [blocked, { data: profile }] = await Promise.all([
        checkIsBlocked(uid, nextPeerId),
        supabase
          .from('profiles')
          .select('display_name, username, avatar_url, is_online, last_seen_at')
          .eq('id', nextPeerId)
          .maybeSingle<{
            display_name: string | null;
            username: string | null;
            avatar_url: string | null;
            is_online: boolean | null;
            last_seen_at: string | null;
          }>(),
      ]);

      setIsBlockedState(blocked);
      setPeerName(profile?.display_name || profile?.username || 'Player');
      setPeerAvatarUrl(profile?.avatar_url ?? null);

      getConversationSettings(conversationId)
        .then((settings) => {
          if (settings) setDisappearingTtl(settings.disappearing_messages_ttl ?? null);
        })
        .catch(() => null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { loadThread().catch(() => null); }, [loadThread]);

  // Load messages after peerId is resolved
  useEffect(() => {
    if (userId && peerId) chatRealtime.loadThread().catch(() => null);
  }, [userId, peerId, chatRealtime.loadThread]);

  useFocusEffect(
    useCallback(() => {
      if (conversationId) markConversationRead(conversationId).catch(() => null);
      return undefined;
    }, [conversationId]),
  );

  // ── Android keyboard height ──
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setAndroidKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setAndroidKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Auto-scroll on new messages ──
  const sortedMessages = useMemo(
    () => [...chatRealtime.messages].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [chatRealtime.messages],
  );

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    const timer = setTimeout(() => {
      (messageListRef.current as any)?.scrollToEnd?.({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [sortedMessages.length]);

  // ── Handlers ──

  const handleSend = useCallback(async (body: string) => {
    if (!conversationId) return;
    chatRealtime.stopTyping();

    if (editingMessage) {
      try {
        await editDmMessage(editingMessage.id, body);
        chatRealtime.setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessage.id ? { ...m, body, edited_at: new Date().toISOString() } : m,
          ),
        );
        setEditingMessage(null);
      } catch (e: any) {
        showAlert('Edit failed', e?.message ?? 'Could not edit message');
      }
      return;
    }

    const replyToId = replyTarget?.id ?? null;
    try {
      shouldAutoScrollRef.current = true;
      const row = await sendMessage(conversationId, body, replyToId);
      chatRealtime.setMessages((prev) => {
        if (prev.some((msg) => msg.id === row.id)) return prev;
        return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      setReplyTarget(null);
    } catch (e: any) {
      showAlert('Send failed', e?.message ?? 'Could not send message');
    }
  }, [conversationId, editingMessage, replyTarget, chatRealtime]);

  const handleSendImage = useCallback(async (uri: string, mime: string, width?: number, height?: number) => {
    if (!conversationId) return;
    try {
      shouldAutoScrollRef.current = true;
      const row = await sendImageMessage(conversationId, uri, mime, width, height);
      chatRealtime.setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    } catch (e: any) {
      showAlert('Failed', e?.message ?? 'Could not send image');
    }
  }, [conversationId, chatRealtime]);

  const handleSendVoice = useCallback(async (uri: string, duration: number) => {
    if (!conversationId) return;
    try {
      shouldAutoScrollRef.current = true;
      const row = await sendVoiceMessage(conversationId, uri, duration);
      chatRealtime.setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    } catch (e: any) {
      showAlert('Failed', e?.message ?? 'Could not send voice message');
    }
  }, [conversationId, chatRealtime]);

  const handlePin = useCallback(async (message: DmMessage) => {
    try {
      if (message.pinned_at) {
        await unpinDmMessage(message.id);
        chatRealtime.setMessages((prev) => prev.map((m) => m.id === message.id ? { ...m, pinned_at: null, pinned_by: null } : m));
      } else {
        await pinDmMessage(message.id);
        const now = new Date().toISOString();
        chatRealtime.setMessages((prev) => prev.map((m) => m.id === message.id ? { ...m, pinned_at: now, pinned_by: userId } : m));
      }
      await chatRealtime.refreshPinnedMessages();
    } catch (e: any) {
      showAlert('Failed', e?.message ?? 'Could not pin message');
    }
  }, [userId, chatRealtime]);

  const handleDelete = useCallback(async (message: DmMessage) => {
    const confirmed = await showConfirm('Delete message?', 'This cannot be undone.', 'Delete');
    if (!confirmed) return;
    try {
      await deleteDmMessage(message.id);
      chatRealtime.setMessages((prev) => prev.map((m) => m.id === message.id ? { ...m, is_deleted: true, body: '' } : m));
    } catch (e: any) {
      showAlert('Failed', e?.message ?? 'Could not delete message');
    }
  }, [chatRealtime]);

  const handleReactionSelect = useCallback(async (messageId: string, emoji: string) => {
    setReactionPickerMessageId(null);
    const uid = userId;
    if (!uid) return;

    // Optimistic update
    chatRealtime.setReactionsMap((prev) => {
      const next = new Map(prev);
      const groups = [...(next.get(messageId) ?? [])];
      const idx = groups.findIndex((g) => g.emoji === emoji);
      if (idx >= 0 && groups[idx].reactedByMe) {
        const newCount = groups[idx].count - 1;
        if (newCount <= 0) groups.splice(idx, 1);
        else groups[idx] = { ...groups[idx], count: newCount, reactedByMe: false };
      } else if (idx >= 0) {
        groups[idx] = { ...groups[idx], count: groups[idx].count + 1, reactedByMe: true };
      } else {
        groups.push({ emoji, count: 1, reactedByMe: true });
      }
      if (groups.length === 0) next.delete(messageId);
      else next.set(messageId, groups.sort((a, b) => b.count - a.count));
      return next;
    });

    try {
      const result = await toggleReaction(messageId, emoji);
      if (chatRealtime.callChannel) {
        broadcastReaction(chatRealtime.callChannel, uid, messageId, emoji, result.added).catch(() => null);
      }
    } catch {
      loadReactionsForMessages([messageId])
        .then((reactions) => {
          if (!uid) return;
          const refreshed = groupReactions(reactions, uid).get(messageId) ?? [];
          chatRealtime.setReactionsMap((prev) => {
            const next = new Map(prev);
            if (refreshed.length === 0) next.delete(messageId);
            else next.set(messageId, refreshed);
            return next;
          });
        })
        .catch(() => null);
    }
  }, [userId, chatRealtime]);

  const handleScroll = useCallback((nearBottom: boolean) => {
    shouldAutoScrollRef.current = nearBottom;
    setShowJumpToLatest((prev) => {
      if (nearBottom && prev) return false;
      if (!nearBottom && !prev) return true;
      return prev;
    });
  }, []);

  const scrollToLatest = useCallback(() => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    (messageListRef.current as any)?.scrollToEnd?.({ animated: true });
  }, []);

  // ── Render message item ──

  const renderMessageItem = useCallback(
    ({ item, isFirstInGroup, isLastInGroup }: { item: DmMessage; isFirstInGroup: boolean; isLastInGroup: boolean }) => {
      const replyTo = item.reply_to_id
        ? chatRealtime.messages.find((m) => m.id === item.reply_to_id) ?? null
        : null;
      return (
        <MessageBubble
          item={item}
          isOwn={item.sender_id === userId}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
          playingVoiceId={playingVoiceId}
          reactions={chatRealtime.reactionsMap.get(item.id) ?? []}
          replyTo={replyTo}
          peerName={peerName}
          currentUserId={userId ?? undefined}
          isPinned={!!item.pinned_at}
          onImagePress={(url) => router.push({ pathname: '/image-viewer', params: { url } })}
          onVoicePress={(url, id) => setPlayingVoiceId((prev) => (prev === id ? null : id))}
          onLongPress={() => setActionMenuMessage(item)}
          onReactionPress={(emoji) => { void handleReactionSelect(item.id, emoji); }}
          onSwipeReply={() => setReplyTarget(item)}
          onReplyQuotePress={() => {
            const idx = sortedMessages.findIndex((m) => m.id === item.reply_to_id);
            if (idx >= 0) {
              (messageListRef.current as any)?.scrollToIndex?.({
                index: idx,
                animated: true,
                viewPosition: 0.3,
              });
            }
          }}
        />
      );
    },
    [userId, playingVoiceId, router, chatRealtime.messages, chatRealtime.reactionsMap, peerName, sortedMessages, handleReactionSelect],
  );

  // ── Render ──

  if (!conversationId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <Text style={{ color: colors.textSecondary }}>Conversation not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ChatHeader
        peerName={peerName}
        peerAvatarUrl={peerAvatarUrl}
        peerIsOnline={chatRealtime.peerIsOnline}
        peerLastSeen={chatRealtime.peerLastSeen}
        peerTyping={chatRealtime.peerTyping}
        pinnedCount={chatRealtime.pinnedMessages.length}
        isBlocked={isBlockedState}
        callDisabled={callSession.callStartDisabled}
        onBack={() => router.replace('/chat')}
        onStartCall={(mode) => void callSession.startCall(mode)}
        onOverflowPress={() => setShowOverflowMenu(true)}
        onPinnedPress={() => {
          if (chatRealtime.pinnedMessages.length > 0) setShowPinnedSheet(true);
        }}
      />

      <ScreenshotWarningBanner />

      <FullScreenCallOverlay
        visible={callSession.showCallOverlay && !callSession.callOverlayMinimized}
        onMinimize={() => callSession.setCallOverlayMinimized(true)}
        callState={callSession.callState}
        activeCallMode={callSession.activeCallMode}
        incomingInvite={callSession.incomingInvite}
        outgoingMode={callSession.outgoingMode}
        peerName={peerName}
        peerAvatarUrl={peerAvatarUrl}
        callMuted={callSession.callMuted}
        cameraEnabled={callSession.cameraEnabled}
        speakerOn={callSession.speakerOn}
        opponentMuted={callSession.opponentMuted}
        localStreamUrl={callSession.localStreamUrl}
        remoteStreamUrl={callSession.remoteStreamUrl}
        isInPiPMode={false}
        onAccept={() => void callSession.acceptCall()}
        onDecline={() => void callSession.declineCall()}
        onEndCall={() => void callSession.endCall(true)}
        onToggleMute={callSession.toggleMute}
        onToggleCamera={callSession.toggleCamera}
        onToggleSpeaker={() => void callSession.toggleSpeaker()}
      />

      {callSession.showCallOverlay && callSession.callOverlayMinimized && (
        <Pressable
          onPress={() => callSession.setCallOverlayMinimized(false)}
          style={[styles.callBar, { backgroundColor: colors.correct }]}
        >
          <Ionicons name={callSession.activeCallMode === 'video' ? 'videocam' : 'call'} size={16} color="#fff" />
          <Text style={styles.callBarText} numberOfLines={1}>
            {callSession.activeCallMode === 'video' ? 'Video' : 'Voice'} call with {peerName}
          </Text>
          {callSession.timeoutCountdown !== null && (
            <Text style={styles.callBarCountdown}>{callSession.timeoutCountdown}s</Text>
          )}
          <Ionicons name="chevron-up" size={18} color="#fff" />
        </Pressable>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={[{ flex: 1 }, chatWallpaper?.type === 'color' ? { backgroundColor: chatWallpaper.value } : {}]}>
          {chatWallpaper?.type === 'image' && (
            <ImageBackground source={{ uri: chatWallpaper.value }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          )}
          <KeyboardAvoidingView
            style={[styles.body, Platform.OS === 'android' ? { paddingBottom: androidKbHeight } : null]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={8}
          >
            <MessageList
              messages={chatRealtime.messages}
              userId={userId}
              peerName={peerName}
              peerTyping={chatRealtime.peerTyping}
              reactionsMap={chatRealtime.reactionsMap}
              playingVoiceId={playingVoiceId}
              composerHeight={composerHeight}
              androidKbHeight={androidKbHeight}
              showJumpToLatest={showJumpToLatest}
              renderMessageItem={renderMessageItem}
              onScroll={handleScroll}
              onScrollToLatest={scrollToLatest}
              listRef={messageListRef}
            />

            <MessageComposer
              conversationId={conversationId}
              isBlocked={isBlockedState}
              editingMessage={editingMessage}
              replyTarget={replyTarget}
              peerName={peerName}
              userId={userId}
              androidKbHeight={androidKbHeight}
              onSend={handleSend}
              onSendImage={handleSendImage}
              onSendVoice={handleSendVoice}
              onInputChange={chatRealtime.notifyTyping}
              onClearEdit={() => setEditingMessage(null)}
              onClearReply={() => setReplyTarget(null)}
              onOpenEmoji={() => setShowEmojiPicker(true)}
              onOpenPollCreator={() => setShowPollCreator(true)}
              onLayout={setComposerHeight}
            />
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Modals */}
      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={(emoji) => {/* TODO: forward to composer */}}
        onClose={() => setShowEmojiPicker(false)}
      />

      <ReactionPicker
        visible={reactionPickerMessageId !== null}
        onSelect={(emoji) => {
          if (reactionPickerMessageId) void handleReactionSelect(reactionPickerMessageId, emoji);
        }}
        onClose={() => setReactionPickerMessageId(null)}
      />

      <MessageActionMenu
        visible={!!actionMenuMessage}
        message={actionMenuMessage}
        isOwn={actionMenuMessage?.sender_id === userId}
        isPinned={!!actionMenuMessage?.pinned_at}
        onClose={() => setActionMenuMessage(null)}
        onReact={() => { if (actionMenuMessage) setReactionPickerMessageId(actionMenuMessage.id); }}
        onReply={() => { if (actionMenuMessage) setReplyTarget(actionMenuMessage); }}
        onEdit={
          actionMenuMessage && !actionMenuMessage.is_deleted && (actionMenuMessage.message_type === 'text' || !actionMenuMessage.message_type)
            ? () => { setEditingMessage(actionMenuMessage); }
            : undefined
        }
        onDelete={actionMenuMessage ? () => { void handleDelete(actionMenuMessage); } : undefined}
        onPin={actionMenuMessage && !actionMenuMessage.is_deleted ? () => { void handlePin(actionMenuMessage); } : undefined}
        onForward={actionMenuMessage && !actionMenuMessage.is_deleted ? () => setForwardingMessage(actionMenuMessage) : undefined}
      />

      <PinnedMessagesSheet
        visible={showPinnedSheet}
        pinnedMessages={chatRealtime.pinnedMessages}
        onClose={() => setShowPinnedSheet(false)}
        onJumpTo={(messageId) => {
          const idx = sortedMessages.findIndex((m) => m.id === messageId);
          if (idx >= 0) {
            (messageListRef.current as any)?.scrollToIndex?.({ index: idx, animated: true, viewPosition: 0.3 });
          }
        }}
      />

      <ForwardMessageSheet
        visible={!!forwardingMessage}
        message={forwardingMessage}
        onClose={() => setForwardingMessage(null)}
      />

      <PollCreatorSheet
        visible={showPollCreator}
        conversationId={conversationId}
        onClose={() => setShowPollCreator(false)}
        onPollCreated={() => {}}
      />

      <MessageSearchSheet
        visible={showSearch}
        messages={sortedMessages}
        onClose={() => setShowSearch(false)}
        onJumpTo={(messageId) => {
          const idx = sortedMessages.findIndex((m) => m.id === messageId);
          if (idx >= 0) {
            (messageListRef.current as any)?.scrollToIndex?.({ index: idx, animated: true, viewPosition: 0.3 });
          }
        }}
      />

      {/* Disappearing Messages Modal */}
      <Modal visible={showDisappearingModal} transparent animationType="slide" onRequestClose={() => setShowDisappearingModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDisappearingModal(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>Disappearing Messages</Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Messages will be deleted after the selected time.</Text>
          {([
            { label: 'Off', value: null },
            { label: '5 minutes', value: 300 },
            { label: '1 hour', value: 3600 },
            { label: '24 hours', value: 86400 },
            { label: '7 days', value: 604800 },
          ] as { label: string; value: number | null }[]).map((opt) => (
            <Pressable
              key={String(opt.value)}
              onPress={async () => {
                if (!conversationId) return;
                try {
                  await setDisappearingMessages(conversationId, opt.value);
                  setDisappearingTtl(opt.value);
                  chatRealtime.callChannel?.send({
                    type: 'broadcast',
                    event: 'dm-settings-update',
                    payload: { fromId: userId, disappearing_ttl: opt.value },
                  }).catch(() => null);
                } catch { /* ignore */ }
                setShowDisappearingModal(false);
              }}
              style={[
                styles.modalOption,
                {
                  backgroundColor: disappearingTtl === opt.value ? `${colors.primary}14` : colors.surfaceVariant,
                  borderColor: disappearingTtl === opt.value ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.modalOptionText, { color: disappearingTtl === opt.value ? colors.primary : colors.text }]}>{opt.label}</Text>
              {disappearingTtl === opt.value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* Overflow Menu */}
      <Modal visible={showOverflowMenu} transparent animationType="fade" onRequestClose={() => setShowOverflowMenu(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setShowOverflowMenu(false)}>
          <View style={[styles.overflowMenu, { backgroundColor: colors.surface, shadowColor: '#000' }]}>
            <Pressable style={styles.overflowMenuItem} onPress={() => { setShowOverflowMenu(false); setShowSearch(true); }}>
              <Ionicons name="search-outline" size={18} color={colors.primary} />
              <Text style={[styles.overflowMenuLabel, { color: colors.text }]}>Search</Text>
            </Pressable>
            <View style={[styles.overflowMenuDivider, { backgroundColor: colors.border }]} />
            <Pressable
              style={[styles.overflowMenuItem, chatRealtime.pinnedMessages.length === 0 && { opacity: 0.4 }]}
              onPress={() => { if (chatRealtime.pinnedMessages.length === 0) return; setShowOverflowMenu(false); setShowPinnedSheet(true); }}
            >
              <Ionicons name="pin-outline" size={18} color={colors.primary} />
              <Text style={[styles.overflowMenuLabel, { color: colors.text }]}>
                Pinned Messages{chatRealtime.pinnedMessages.length > 0 ? ` (${chatRealtime.pinnedMessages.length})` : ''}
              </Text>
            </Pressable>
            <View style={[styles.overflowMenuDivider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.overflowMenuItem} onPress={() => { setShowOverflowMenu(false); setShowDisappearingModal(true); }}>
              <Ionicons name={disappearingTtl ? 'timer' : 'timer-outline'} size={18} color={disappearingTtl ? colors.primary : colors.textSecondary} />
              <Text style={[styles.overflowMenuLabel, { color: colors.text }]}>Disappearing Messages{disappearingTtl ? ' (On)' : ''}</Text>
            </Pressable>
            <View style={[styles.overflowMenuDivider, { backgroundColor: colors.border }]} />
            <Pressable
              style={styles.overflowMenuItem}
              onPress={async () => {
                setShowOverflowMenu(false);
                if (!peerId) return;
                if (isBlockedState) {
                  const confirmed = await showConfirm('Unblock User', `Unblock ${peerName}?`, 'Unblock');
                  if (!confirmed) return;
                  try { await unblockUser(peerId); setIsBlockedState(false); } catch { /* ignore */ }
                } else {
                  const confirmed = await showConfirm('Block User', `Block ${peerName}?`, 'Block');
                  if (!confirmed) return;
                  try { await blockUser(peerId); setIsBlockedState(true); } catch { /* ignore */ }
                }
              }}
            >
              <Ionicons name={isBlockedState ? 'ban' : 'ban-outline'} size={18} color={isBlockedState ? colors.warning : colors.wrong} />
              <Text style={[styles.overflowMenuLabel, { color: isBlockedState ? colors.warning : colors.wrong }]}>
                {isBlockedState ? 'Unblock' : 'Block'} {peerName}
              </Text>
            </Pressable>
            <View style={[styles.overflowMenuDivider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.overflowMenuItem} onPress={() => { setShowOverflowMenu(false); setShowReportModal(true); }}>
              <Ionicons name="flag-outline" size={18} color={colors.wrong} />
              <Text style={[styles.overflowMenuLabel, { color: colors.wrong }]}>Report</Text>
            </Pressable>
            <View style={[styles.overflowMenuDivider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.overflowMenuItem} onPress={() => { setShowOverflowMenu(false); setShowWallpaperPicker(true); }}>
              <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
              <Text style={[styles.overflowMenuLabel, { color: colors.text }]}>Chat Wallpaper{chatWallpaper ? ' (Set)' : ''}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Wallpaper Picker */}
      <Modal visible={showWallpaperPicker} transparent animationType="slide" onRequestClose={() => setShowWallpaperPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowWallpaperPicker(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>Chat Wallpaper</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 4 }}>
              {[
                { label: 'Default', color: null },
                { label: 'Midnight', color: '#0a0a1a' },
                { label: 'Ocean', color: '#0d2137' },
                { label: 'Forest', color: '#0d1f16' },
                { label: 'Berry', color: '#1a0d2e' },
                { label: 'Rose', color: '#2d0d1a' },
                { label: 'Slate', color: '#1e293b' },
              ].map(({ label, color }) => {
                const isSelected = color === null ? chatWallpaper === null : chatWallpaper?.type === 'color' && chatWallpaper.value === color;
                return (
                  <Pressable
                    key={label}
                    onPress={async () => {
                      const next = color === null ? null : { type: 'color' as const, value: color };
                      setChatWallpaper(next);
                      if (conversationId) await setItem(`chat_wallpaper_${conversationId}`, next === null ? '' : JSON.stringify(next));
                      setShowWallpaperPicker(false);
                    }}
                    style={{ alignItems: 'center', gap: 6 }}
                  >
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color ?? colors.surfaceVariant, borderWidth: isSelected ? 3 : 1.5, borderColor: isSelected ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                      {color === null && <Ionicons name="close" size={20} color={colors.textSecondary} />}
                      {isSelected && color !== null && <Ionicons name="checkmark" size={20} color="#fff" />}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Pressable
            onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85 });
              if (result.canceled || !result.assets[0]) return;
              const next = { type: 'image' as const, value: result.assets[0].uri };
              setChatWallpaper(next);
              if (conversationId) await setItem(`chat_wallpaper_${conversationId}`, JSON.stringify(next));
              setShowWallpaperPicker(false);
            }}
            style={[styles.modalOption, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary, flexDirection: 'row', gap: 10 }]}
          >
            <Ionicons name="image-outline" size={20} color={colors.primary} />
            <Text style={[styles.modalOptionText, { color: colors.primary }]}>Choose from Gallery</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowReportModal(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>Report {peerName}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {([
              { label: 'Spam', value: 'spam' },
              { label: 'Harassment', value: 'harassment' },
              { label: 'Inappropriate content', value: 'inappropriate_content' },
              { label: 'Hate speech', value: 'hate_speech' },
              { label: 'Impersonation', value: 'impersonation' },
              { label: 'Other', value: 'other' },
            ] as { label: string; value: ReportReason }[]).map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setReportReason(opt.value)}
                style={[
                  styles.modalOption,
                  { backgroundColor: reportReason === opt.value ? `${colors.wrong}14` : colors.surfaceVariant, borderColor: reportReason === opt.value ? colors.wrong : colors.border },
                ]}
              >
                <Text style={[styles.modalOptionText, { color: reportReason === opt.value ? colors.wrong : colors.text }]}>{opt.label}</Text>
                {reportReason === opt.value && <Ionicons name="checkmark" size={16} color={colors.wrong} />}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={async () => {
              if (!peerId) return;
              try {
                await reportUser(peerId, reportReason, undefined, 'dm', conversationId);
                setShowReportModal(false);
                showAlert('Reported', 'Thank you for your report.');
              } catch (e: any) {
                showAlert('Error', e?.message ?? 'Could not submit report');
              }
            }}
            style={[styles.reportSubmitBtn, { backgroundColor: colors.wrong }]}
          >
            <Text style={styles.reportSubmitText}>Submit Report</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  callBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  callBarText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  callBarCountdown: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xs },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  modalSubtitle: { fontSize: fontSize.sm, marginBottom: spacing.xs },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalOptionText: { fontSize: fontSize.base },
  reportSubmitBtn: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  reportSubmitText: { color: '#fff', fontSize: fontSize.base, fontWeight: fontWeight.bold },
  overflowMenu: {
    position: 'absolute',
    top: 60,
    right: 12,
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 210,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  overflowMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  overflowMenuLabel: { fontSize: 15, fontWeight: '500' },
  overflowMenuDivider: { height: 1, marginHorizontal: 12 },
});
