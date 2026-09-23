import React from "react";

interface PlayerIconProps {
  name: string;
  seat: number;
  isDealer?: boolean;
  isActive?: boolean;
  isCurrent?: boolean;
}

export default function PlayerIcon({
  name,
  seat,
  isDealer = false,
  isActive = false,
  isCurrent = false,
}: PlayerIconProps) {
  const teamColor = seat % 2 === 0
    ? "border-[#71a7d8]"
    : "border-[#df756e]";

  return (
    <div className="inline-flex min-w-16 flex-col items-center sm:min-w-20 lg:min-w-24">
      <div className="relative">
        <div
          className={`grid h-11 w-11 place-items-center rounded-lg border-[3px] bg-[#454341] text-base font-extrabold text-white shadow-[0_5px_12px_rgba(0,0,0,.32)] sm:h-13 sm:w-13 sm:text-lg lg:h-14 lg:w-14 lg:text-xl ${teamColor} ${isActive ? "scale-105 ring-4 ring-[#81b64c]/70 ring-offset-2 ring-offset-[#262522]" : ""}`}
        >
          {name.charAt(0).toUpperCase()}
        </div>

        {isDealer && (
          <div className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-[#262522] bg-[#f0c95a] text-[10px] font-black text-[#2b2926] shadow-md" title="Dealer">
            D
          </div>
        )}
      </div>
      <div className="mt-1.5 flex max-w-28 items-center gap-1 rounded-md border border-white/8 bg-[#312e2b]/95 px-2 py-1 shadow-lg">
        <span className="truncate text-[10px] font-bold text-[#f1f1ef] sm:text-xs">{name}</span>
        {isCurrent && <span className="text-[8px] font-black uppercase tracking-wider text-[#81b64c]">You</span>}
      </div>
    </div>
  );
}
