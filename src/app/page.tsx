import { Suspense } from "react";
import { Tide } from "@/components/Tide";

export default function Page() {
  return (
    <Suspense fallback={<div className="boot">Opening your workspace…</div>}>
      <Tide />
    </Suspense>
  );
}
