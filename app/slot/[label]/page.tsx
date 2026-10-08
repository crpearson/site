import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AliasStub } from "@/components/AliasStub";
import { SlotDetail } from "@/components/SlotDetail";
import { getSlot, slotLabels } from "@/lib/fleet";

export const dynamicParams = false;

export function generateStaticParams() {
  const ids = new Set<string>();
  for (const label of slotLabels()) {
    ids.add(label);
    ids.add(label.toLowerCase());
  }
  return [...ids].map((label) => ({ label }));
}

export async function generateMetadata({
  params,
}: PageProps<"/slot/[label]">): Promise<Metadata> {
  const { label } = await params;
  const canonicalLabel = slotLabels().find((item) => item.toLowerCase() === label.toLowerCase());
  if (!canonicalLabel) return { title: label };
  const canonical = `/slot/${canonicalLabel}/`;
  return {
    title: canonicalLabel,
    description: `Current and past occupants of slot ${canonicalLabel}.`,
    alternates: { canonical },
    ...(canonicalLabel !== label ? { other: { refresh: `0; url=${canonical}` } } : {}),
  };
}

export default async function SlotPage({ params }: PageProps<"/slot/[label]">) {
  const { label } = await params;
  const canonicalLabel = slotLabels().find((item) => item.toLowerCase() === label.toLowerCase());
  if (!canonicalLabel || !getSlot(canonicalLabel)) notFound();
  if (canonicalLabel !== label) {
    return <AliasStub href={`/slot/${canonicalLabel}/`} title={canonicalLabel} />;
  }
  return <SlotDetail label={canonicalLabel} />;
}
