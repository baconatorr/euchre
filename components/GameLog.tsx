export default function GameLog({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <details
      className="mx-auto mt-3 w-full max-w-4xl rounded-lg bg-black/15 text-xs text-white sm:text-sm"
    >
      <summary className="cursor-pointer px-3 py-2 font-medium">Game log</summary>
      <div className="max-h-32 space-y-1 overflow-y-auto break-words px-3 pb-3 sm:max-h-48">
        {messages.map((message, index) => (
          <p key={`${index}-${message}`}>{message}</p>
        ))}
      </div>
    </details>
  );
}
