import type { Metadata } from "next";
import { SectionStub } from "@/components/SectionStub";

export const metadata: Metadata = {
  title: "Drone Builds",
  description: "I haven't posted any build logs yet. When I do, each one will list every part, the specs, photos, and what I'd do differently next time.",
};

export default function BuildsPage() {
  return (
    <SectionStub
      dir="builds"
      title="Drone Builds"
      outlineTitle="What each build log will cover"
      outline={[
        { title: "Parts list", body: "Every part, with the price when I checked." },
        { title: "Specs", body: "Size, weight and battery." },
        { title: "Lessons learned", body: "What I'd do differently next time." },
      ]}
    />
  );
}
