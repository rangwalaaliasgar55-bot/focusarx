import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI roadmap — Focusarx",
  description: "Personalized study and productivity roadmap powered by AI.",
};

export default function RoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
