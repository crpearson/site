import type { Metadata } from "next";
import { SectionStub } from "@/components/SectionStub";

export const metadata: Metadata = {
  title: "HOWTOs",
  description: "Step-by-step guides for the jobs I do over and over. First ones coming soon.",
};

export default function HowtosPage() {
  return (
    <SectionStub
      dir="howtos"
      title="HOWTOs"
      outlineTitle="What each guide will cover"
      outline={[
        { title: "Goal", body: "The one job the guide is for." },
        { title: "Steps", body: "What you need, then the steps in order." },
        { title: "Troubleshooting", body: "What to try when a step doesn't go as planned." },
      ]}
    />
  );
}
