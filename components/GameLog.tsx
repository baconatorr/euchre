export default function GameLog({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <details
      className="surface-panel mx-auto mt-2 w-full max-w-4xl rounded-lg text-xs text-[#d8d7d5] sm:text-sm"
    >
      <summary className="px-3 py-2 font-semibold text-[#b7b5b2]">Game history</summary>
      <div className="max-h-32 space-y-1 overflow-y-auto break-words border-t border-white/8 px-3 py-3 sm:max-h-48">
        {messages.map((message, index) => (
          <p key={`${index}-${message}`}>{message}</p>
        ))}
      </div>
    </details>
  );
}
