/**
 * HubTabs — navigasi hub dengan maksimal 6 KELOMPOK di baris utama + sub-tab garis untuk kelompok berisi > 1 halaman
 * (DESIGN_SYSTEM §10.8). Dasar: Carbon (≤ 6 tab per bar), NN/g (jangan dua baris tab setara; kelompokkan menjadi
 * sub-kategori), Material (gulir bila tetap tidak muat).
 *
 *   <HubTabs
 *     groups={[{ id: "ap", label: "Hutang (AP)", icon, items: [{ id: "payments", label: "Payments", icon }, …] }]}
 *     value={activeTabId} onChange={(tabId) => …}
 *     testId="payments-hub-tabs" itemTestId={(id) => `payments-tab-${id}`} groupTestId={(id) => `payments-group-${id}`}
 *   />
 *
 * - `value`/`onChange` tetap memakai id halaman (?tab= lama tetap berlaku untuk deep-link & tour).
 * - Kelompok kosong (RBAC) disembunyikan; kelompok berisi 1 halaman = tab biasa dengan testid halaman itu.
 * - Pindah kelompok membuka halaman terakhir yang dibuka di kelompok itu (atau yang pertama).
 */
import { useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function HubTabs({ groups, value, onChange, testId, itemTestId = (id) => id, groupTestId = (id) => `group-${id}`, ariaLabel }) {
  const visible = groups.filter((g) => g.items && g.items.length > 0);
  const last = useRef({});
  const active = visible.find((g) => g.items.some((i) => i.id === value)) || visible[0];
  if (!active) return null;
  last.current[active.id] = value;

  const openGroup = (gid) => {
    const g = visible.find((x) => x.id === gid);
    if (!g) return;
    const remembered = last.current[gid];
    onChange(g.items.some((i) => i.id === remembered) ? remembered : g.items[0].id);
  };

  return (
    <div className="space-y-2" data-testid={testId ? `${testId}-nav` : undefined}>
      <Tabs value={active.id} onValueChange={openGroup}>
        <TabsList data-testid={testId} aria-label={ariaLabel}>
          {visible.map((g) => {
            const single = g.items.length === 1 ? g.items[0] : null;
            const Icon = g.icon || single?.icon;
            return (
              <TabsTrigger key={g.id} value={g.id} data-testid={single ? itemTestId(single.id) : groupTestId(g.id)}>
                {Icon && <Icon />}
                {single ? single.label : g.label}
                {g.badge}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      {active.items.length > 1 && (
        <Tabs value={value} onValueChange={onChange}>
          <TabsList variant="line" data-testid={testId ? `${testId}-sub` : undefined} aria-label={active.label}>
            {active.items.map((i) => {
              const Icon = i.icon;
              return (
                <TabsTrigger key={i.id} value={i.id} data-testid={itemTestId(i.id)}>
                  {Icon && <Icon />}
                  {i.label}
                  {i.badge}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}

/** Bantu: kelompokkan daftar tab (urutan & RBAC tetap dari daftar asli) menurut peta { groupId: [tabId…] }. */
export function groupTabs(tabs, groupDefs) {
  return groupDefs.map((g) => ({ ...g, items: g.ids.map((id) => tabs.find((t) => t.id === id)).filter(Boolean) }));
}
