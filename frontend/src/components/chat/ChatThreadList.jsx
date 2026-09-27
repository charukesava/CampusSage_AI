import Button from "../common/Button";
import Card from "../common/Card";

export default function ChatThreadList({
  chats,
  activeChatId,
  onSelect,
  onNewConversation,
}) {
  return (
    <Card className="cs-chat-list">
      <div className="cs-chat-list__header">
        <div>
          <h3>Chat History</h3>
          <p>Continue from your saved conversations</p>
        </div>
        <Button variant="secondary" onClick={onNewConversation}>
          New
        </Button>
      </div>

      <div className="cs-chat-list__items">
        {chats.map((chat) => (
          <button
            key={chat.id}
            className={`cs-chat-list__item ${chat.id === activeChatId ? "is-active" : ""}`}
            onClick={() => onSelect(chat.id)}
          >
            <strong>{chat.title}</strong>
            <span>
              {chat.messages[chat.messages.length - 1]?.content?.slice(0, 54) ||
                "Start a new conversation"}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
