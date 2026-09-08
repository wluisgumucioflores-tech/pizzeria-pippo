"use client";
import { ChangelogList } from "@/features/changelog/components/ChangelogList";
import { CHANGELOG } from "@/features/changelog/constants/changelog.constants";

export default function ChangelogPage() {
  return (
    <div className="p-6">
      <ChangelogList entries={CHANGELOG} />
    </div>
  );
}
