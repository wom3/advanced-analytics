"use client";

import type { LlamaTimeSeriesPoint } from "@/src/server/adapters/defillama/client";

type FlowExportActionsProps = {
  chain: string;
  protocol?: string | undefined;
  volumePoints: LlamaTimeSeriesPoint[];
  tvlPoints: LlamaTimeSeriesPoint[];
};

type ExportRow = {
  timestamp: string;
  dexVolumeUsd: number | null;
  tvlUsd: number | null;
  netTvlFlowUsd: number | null;
};

function sanitizeForFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toNetFlowByTimestamp(points: LlamaTimeSeriesPoint[]): Map<string, number> {
  const result = new Map<string, number>();
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const previous = points[index - 1];
    if (!point) {
      continue;
    }

    if (!previous) {
      result.set(point.timestamp, 0);
      continue;
    }

    const netFlow = Number((point.value - previous.value).toFixed(2));
    result.set(point.timestamp, Number.isFinite(netFlow) ? netFlow : 0);
  }

  return result;
}

function buildRows(
  volumePoints: LlamaTimeSeriesPoint[],
  tvlPoints: LlamaTimeSeriesPoint[]
): ExportRow[] {
  const volumeByTimestamp = new Map(volumePoints.map((point) => [point.timestamp, point.value]));
  const tvlByTimestamp = new Map(tvlPoints.map((point) => [point.timestamp, point.value]));
  const netFlowByTimestamp = toNetFlowByTimestamp(tvlPoints);

  const timestamps = new Set<string>([
    ...volumeByTimestamp.keys(),
    ...tvlByTimestamp.keys(),
    ...netFlowByTimestamp.keys(),
  ]);

  return [...timestamps]
    .sort((left, right) => left.localeCompare(right))
    .map((timestamp) => ({
      timestamp,
      dexVolumeUsd: volumeByTimestamp.get(timestamp) ?? null,
      tvlUsd: tvlByTimestamp.get(timestamp) ?? null,
      netTvlFlowUsd: netFlowByTimestamp.get(timestamp) ?? null,
    }));
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function toCsv(rows: ExportRow[]): string {
  const header = ["timestamp", "dex_volume_usd", "tvl_usd", "net_tvl_flow_usd"];
  const lines = rows.map((row) =>
    [
      row.timestamp,
      row.dexVolumeUsd === null ? "" : String(row.dexVolumeUsd),
      row.tvlUsd === null ? "" : String(row.tvlUsd),
      row.netTvlFlowUsd === null ? "" : String(row.netTvlFlowUsd),
    ]
      .map(escapeCsvField)
      .join(",")
  );

  return [header.join(","), ...lines].join("\n");
}

function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function FlowExportActions({
  chain,
  protocol,
  volumePoints,
  tvlPoints,
}: FlowExportActionsProps) {
  const rows = buildRows(volumePoints, tvlPoints);
  const scope = protocol ? `${chain}-${protocol}` : `${chain}-all`;
  const fileScope = sanitizeForFileName(scope);
  const fileDate = new Date().toISOString().slice(0, 10);

  function exportJson(): void {
    const payload = {
      source: "defillama",
      exportedAt: new Date().toISOString(),
      filters: {
        chain,
        protocol: protocol ?? null,
      },
      rows,
    };

    downloadTextFile(
      JSON.stringify(payload, null, 2),
      `flows-${fileScope}-${fileDate}.json`,
      "application/json"
    );
  }

  function exportCsv(): void {
    downloadTextFile(toCsv(rows), `flows-${fileScope}-${fileDate}.csv`, "text/csv");
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Export Actions</h2>
          <p className="mt-1 text-xs text-slate-500">
            Download the active flows scope as CSV or JSON.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Export JSON
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Rows: <span className="font-medium text-slate-700">{rows.length}</span>
        {" · Scope: "}
        <span className="font-medium text-slate-700">{chain}</span>
        {protocol ? (
          <>
            {" / "}
            <span className="font-medium text-slate-700">{protocol}</span>
          </>
        ) : (
          <>{" / all protocols"}</>
        )}
      </p>
    </section>
  );
}
