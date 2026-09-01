import React from 'react'

interface PlayerIconProps {
  name: string;
  seat: number;
}

export default function PlayerIcon({ name, seat }: PlayerIconProps){
  let color = seat % 2 == 0 ? "border-blue-500" : "border-red-500"
  return (
   <div className='inline-flex flex-col '>
    <div className={`${color} p-3 items-center justify-center border-2`}>{name[0].toUpperCase()}</div>
    <div>{name}</div>
   </div>
  )
}
