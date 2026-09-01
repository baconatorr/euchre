export default function GameLog({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-h-48 w-[calc(100vw-2rem)] overflow-y-auto border border-green-900 bg-white/95 p-4 text-sm text-black shadow-lg sm:w-80"
    >
      <div>
        {messages.map((message, index) => (
          <p key={`${index}-${message}`}>{message}</p>
        ))}
      </div>
    </div>
  );
}