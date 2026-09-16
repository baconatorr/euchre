import Image from "next/image";
import type { Card } from "@/lib/gameSocket";

const suitNames = {
  clubs: "CLUB",
  diamonds: "DIAMOND",
  hearts: "HEART",
  spades: "SPADE",
};

const rankNames = {
  "9": "9",
  "10": "10",
  J: "11-JACK",
  Q: "12-QUEEN",
  K: "13-KING",
  A: "1",
};

export default function PlayingCard({ card, compact = false }: { card?: Card; compact?: boolean }) {
  const src = card
    ? `/card-svgs/FACES%20(BORDERED)/STANDARD%20BORDERED/Single%20Cards%20(One%20Per%20FIle)/${suitNames[card.suit]}-${rankNames[card.rank]}.svg`
    : "/card-svgs/card-back.svg";

  return (
    <Image
      src={src}
      alt={card ? `${card.rank} of ${card.suit}` : "Face-down card"}
      width={63}
      height={88}
      unoptimized
      draggable={false}
      className={`h-auto shrink-0 rounded-md shadow-md ${compact ? "w-7 sm:w-9 lg:w-10" : "w-11 sm:w-14 lg:w-16"}`}
    />
  );
}
