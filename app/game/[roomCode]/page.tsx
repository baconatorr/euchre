export default async function Page({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  
  return <h1>room: {roomCode}</h1>;
}
