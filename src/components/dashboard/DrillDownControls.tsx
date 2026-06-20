"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface Unit {
  id: string;
  name: string;
}

export function DrillDownControls({
  units,
  from,
  to,
  businessUnitId,
}: {
  units: Unit[];
  from: string;
  to: string;
  businessUnitId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/drill-down?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="From">
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => update("from", e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </Field>
      <Field label="To">
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => update("to", e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </Field>
      <Field label="Business Unit">
        <select
          value={businessUnitId}
          onChange={(e) => update("unit", e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">All units</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
      {pending && <span className="pb-2 text-xs text-gray-400">Updating…</span>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}
