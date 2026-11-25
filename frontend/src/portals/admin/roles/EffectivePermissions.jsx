/** Izin efektif seorang user = gabungan semua perannya, dikelompokkan per portal → modul, dengan asal peran.
 *  API: GET /admin/users/:id/effective-permissions (butuh admin.role.manage). */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import LoadingState from "@/components/shared/LoadingState";
import { indexCatalog } from "./permissionUtils";

export default function EffectivePermissionsButton({ user }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid={`user-effective-perms-${user.id}`}>
        <KeyRound /> Izin efektif
      </Button>
      {open && <EffectivePermissionsSheet user={user} open={open} onOpenChange={setOpen} />}
    </>
  );
}

function EffectivePermissionsSheet({ user, open, onOpenChange }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "effective-perms", user.id],
    queryFn: async () => unwrap(await api.get(`/admin/users/${user.id}/effective-permissions`)),
  });
  const { data: catalog } = useQuery({
    queryKey: ["admin", "permissions", "grouped"],
    queryFn: async () => unwrap(await api.get("/admin/permissions", { params: { grouped: true } })),
    staleTime: 10 * 60 * 1000,
  });
  const groups = useMemo(() => {
    if (!data || !catalog) return [];
    const idx = indexCatalog(catalog);
    const by = {};
    data.permissions.forEach((p) => {
      const meta = idx[p.code];
      const portal = meta?.portal?.label || "Lainnya";
      const mod = meta?.module?.label || p.code;
      ((by[portal] = by[portal] || {})[mod] = by[portal][mod] || []).push({ ...p, label: meta?.perm?.label || p.code, sensitive: meta?.perm?.sensitive });
    });
    return Object.entries(by);
  }, [data, catalog]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto" data-testid="effective-perms-sheet">
        <SheetHeader>
          <SheetTitle>Izin efektif — {user.full_name}</SheetTitle>
          <SheetDescription>
            {data ? `${data.full_access ? "Akses penuh (Super Admin)" : `${data.permissions.length} izin`} dari peran: ${data.roles.map((r) => r.name).join(", ") || "—"}` : "Memuat…"}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {isLoading ? <LoadingState rows={6} /> : groups.map(([portal, mods]) => (
            <div key={portal}>
              <h4 className="text-sm font-semibold mb-1">{portal}</h4>
              <ul className="space-y-1">
                {Object.entries(mods).map(([mod, perms]) => (
                  <li key={mod} className="text-sm">
                    <span className="text-muted-foreground">{mod}:</span>{" "}
                    {perms.map((p, i) => (
                      <span key={p.code} title={`${p.code} · dari ${p.roles.join(", ")}`} className={p.sensitive ? "text-amber-800 dark:text-amber-400" : undefined}>
                        {p.label}{i < perms.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
