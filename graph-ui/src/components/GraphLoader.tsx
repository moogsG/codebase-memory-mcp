import type { LoadProgress } from "../hooks/useGraphData";
import { BrandMark } from "./BrandMark";

/* The product sigil doubles as a tiny graph-orbit loader. Its motion is pure
 * CSS and becomes a static, fully branded mark under reduced motion. */

function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

interface GraphLoaderProps {
  nodeBudget: number;
  progress: LoadProgress;
}

export function GraphLoader({ nodeBudget, progress }: GraphLoaderProps) {
  const receiving = progress.receivedBytes > 0;
  return (
    <div
      className="text-center"
      role="status"
      aria-label="Loading Jynx Observatory graph"
      aria-live="polite"
    >
      <BrandMark className="mx-auto h-20 w-20" animated />
      <p className="text-muted-foreground text-sm mt-4">
        {receiving ? "Receiving graph" : "Computing layout"} — up to{" "}
        {nodeBudget.toLocaleString("en-US")} nodes
      </p>
      <p className="text-primary/80 text-xs font-mono mt-1 h-4">
        {receiving
          ? progress.totalBytes
            ? `${formatMegabytes(progress.receivedBytes)} of ${formatMegabytes(progress.totalBytes)} MB`
            : `${formatMegabytes(progress.receivedBytes)} MB received`
          : " "}
      </p>
    </div>
  );
}
