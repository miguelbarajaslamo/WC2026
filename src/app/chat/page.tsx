import { AppShell } from "@/components/app/app-shell";
import { ChatView } from "@/components/views/chat-view";

export default function ChatPage() {
  return (
    <AppShell kicker="Talk to your pool" title="Chat">
      <ChatView />
    </AppShell>
  );
}
