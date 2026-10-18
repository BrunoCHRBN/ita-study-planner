import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { getPlannerSnapshot } from "@/lib/planner-data";
import {
  formatEditorialDatePtBr,
  formatMinutes,
} from "@/lib/date-utils";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "ITA · Organizador Editorial de Estudos",
  description:
    "Sistema desktop de planejamento, controle de sobrecarga, revisões espaçadas e assistente de IA para o vestibular do ITA.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const snapshot = await getPlannerSnapshot();

  const todayData = snapshot.weekDays.find(
    (d) => d.date === snapshot.todayIso
  );
  const plannedMins = todayData?.analysis.plannedMinutes ?? 0;
  const completedMins = todayData?.analysis.completedMinutes ?? 0;
  const todayPercent =
    plannedMins > 0 ? Math.round((completedMins / plannedMins) * 100) : 0;

  const summary = {
    todayFormatted: formatEditorialDatePtBr(snapshot.todayIso),
    todayPlannedStr: formatMinutes(plannedMins),
    todayCompletedStr: formatMinutes(completedMins),
    todayPercent,
    nextSessionTitle: snapshot.nextSession?.title ?? null,
    nextSessionDiscipline: snapshot.nextSession?.disciplineId ?? null,
    overloadedDaysCount: snapshot.weekDays.filter(
      (d) => d.analysis.isOverloaded
    ).length,
    overdueReviewsCount: snapshot.overdueReviews.length,
    todayReviewsCount: snapshot.todayReviews.length,
  };

  return (
    <html
      lang="pt-BR"
      className={`${newsreader.variable} ${plexSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <AppShell summary={summary}>{children}</AppShell>
      </body>
    </html>
  );
}
