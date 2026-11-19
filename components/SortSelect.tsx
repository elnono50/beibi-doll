"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  ["destacados", "Destacados"],
  ["nuevos", "Lo nuevo"],
  ["menor-precio", "Menor precio"],
  ["mayor-precio", "Mayor precio"],
] as const;

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="sort">
      Ordenar
      <select
        className="select"
        value={value}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString());
          if (e.target.value === "destacados") p.delete("orden");
          else p.set("orden", e.target.value);
          router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
        }}
      >
        {OPTIONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
