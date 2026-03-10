import { GroupChatScreen } from '@/components/chat/GroupChatScreen';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function GroupChatRoute() {
  return (
    <ErrorBoundary>
      <GroupChatScreen />
    </ErrorBoundary>
  );
}
