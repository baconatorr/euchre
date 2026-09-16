import React from "react";

interface PlayerIconProps {
  name: string;
  seat: number;
  isDealer?: boolean;
}

export default function PlayerIcon({
  name,
  seat,
  isDealer = false,
}: PlayerIconProps) {
  const color = seat % 2 === 0 ? "bg-blue-500" : "bg-red-500";

  return (
    <div className="inline-flex min-w-14 flex-col items-center gap-2 sm:min-w-20 lg:min-w-24">
      <div className="relative">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-white text-lg sm:h-14 sm:w-14 sm:text-xl lg:h-16 lg:w-16 lg:text-2xl font-medium text-white ${color} ${
            isDealer
              ? "shadow-[0_0_18px_6px_rgba(250,204,21,0.75)]"
              : ""
          }`}
        >
          {name.charAt(0).toUpperCase()}
        </div>

        {isDealer && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-yellow-400 px-2 py-0.5 text-[8px] font-bold sm:text-[10px]  text-black shadow-md">
            DEALER
          </div>
        )}
      </div>
    </div>
  );
}