import { useMemo, useRef } from "react";
import { Upload } from "lucide-react";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import ChatComposer from "../components/chat/ChatComposer";
import ChatMessage from "../components/chat/ChatMessage";
import ChatThreadList from "../components/chat/ChatThreadList";
import SectionHeader from "../components/common/SectionHeader";
import { createSuggestedQuestions } from "../services/chatService";
import { useApp } from "../context/AppContext";

export default function Chat() {
  const fileInputRef = useRef(null);
  const {
    activeChat,
    chats,
    activeChatId,
    selectChat,
    startNewChat,
    sendMessage,
    regenerateLastReply,
    chatLoading,
    chatError,
    documents,
    addDocuments,
    profile,
  } = useApp();
  const suggestedQuestions = useMemo(() => createSuggestedQuestions(), []);

  async function handleCopy(text) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="cs-chat-page">
      <div className="cs-chat-page__header">
        <SectionHeader
          title="AI Assistant"
          subtitle="Ask me anything about your academic life"
          action={
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} /> Upload Document
            </Button>
          }
        />
      </div>

      <div className="cs-chat-page__grid">
        <ChatThreadList
          chats={chats}
          activeChatId={activeChatId}
          onSelect={selectChat}
          onNewConversation={startNewChat}
        />

        <Card className="cs-chat-panel">
          <div className="cs-chat-panel__toolbar">
            <div>
              <strong>{activeChat?.title || "New conversation"}</strong>
              <p>{documents.length} source documents available</p>
            </div>
            <Button variant="ghost" onClick={regenerateLastReply}>
              Regenerate
            </Button>
          </div>

          <div className="cs-chat-panel__messages">
            {!activeChat?.messages?.length ? (
              <EmptyState
                title="Start a conversation"
                description="Ask a question using your uploaded notes, timetable, or study plan."
                actionLabel="Try a suggested question"
                onAction={() => sendMessage(suggestedQuestions[0])}
              />
            ) : (
              activeChat.messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onRegenerate={regenerateLastReply}
                  onCopy={handleCopy}
                />
              ))
            )}
            {chatLoading ? (
              <div className="cs-chat-panel__typing">
                CampusSage is typing<span>.</span>
                <span>.</span>
                <span>.</span>
              </div>
            ) : null}
            {chatError ? (
              <div className="cs-chat-panel__error">{chatError}</div>
            ) : null}
          </div>

          <ChatComposer
            onSend={sendMessage}
            onAttach={() => fileInputRef.current?.click()}
            disabled={chatLoading}
            suggestedQuestions={suggestedQuestions}
            language={profile?.preferredLanguage || "English"}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="cs-hidden-input"
            multiple
            accept=".pdf,.docx,.pptx"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              if (files.length) addDocuments(files);
              event.target.value = "";
            }}
          />
        </Card>
      </div>
    </div>
  );
}
