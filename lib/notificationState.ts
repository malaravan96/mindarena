/**
 * Shared mutable ref tracking which conversation the user is currently viewing.
 * Used by the notification handler to suppress push banners for the active chat,
 * and by chat screens to update the value on mount/unmount.
 */
let _activeConversationId: string | null = null;
let _activeGroupId: string | null = null;

export function getActiveConversationId(): string | null {
  return _activeConversationId;
}

export function setActiveConversationId(id: string | null) {
  _activeConversationId = id;
}

export function getActiveGroupId(): string | null {
  return _activeGroupId;
}

export function setActiveGroupId(id: string | null) {
  _activeGroupId = id;
}
