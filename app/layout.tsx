import type { Metadata } from "next";
import { Henny_Penny, Outfit } from "next/font/google";
import { GameSocketProvider } from "@/context/GameSocketContext";
import "./globals.css";

const hennyPenny = Henny_Penny({
  variable: "--font-henny-penny-family",
  subsets: ["latin"],
  weight: "400",
});

const outfit = Outfit({
  variable: "--font-outfit-family",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Euchre Table",
  description: "Play a private game of Euchre with friends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${hennyPenny.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <GameSocketProvider>{children}</GameSocketProvider>
      </body>
    </html>
  );
}
