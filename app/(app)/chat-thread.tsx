import { ChatThreadScreen } from '@/components/chat/ChatThreadScreen';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function ChatThreadRoute() {
  return (
    <ErrorBoundary>
      <ChatThreadScreen />
    </ErrorBoundary>
  );
}
