import type { Metadata } from "next";
import { SectionStub } from "@/components/SectionStub";

export const metadata: Metadata = {
  title: "Suggested Equipment",
  description: "A short list of gear I'd actually recommend: why I'd pick it, where to get it, and what it cost when I checked.",
};

export default function GearPage() {
  return (
    <SectionStub
      dir="gear"
      title="Suggested Equipment"
      outlineTitle="What each gear note will cover"
      outline={[
        { title: "What it is", body: "The piece, and whether I use it." },
        { title: "Why I'd pick it", body: "Why I'd recommend it, and who should skip it." },
        { title: "Price", body: "What it cost when I checked, and where to get it." },
      ]}
    />
  );
}
