/** CMSMenu/index.jsx — CMSMenu orchestrator. */
/**
 * CMS E-Menu — Admin CMS for managing brand menu items, categories, and PDF menus.
 * Uses new admin_menu.py API: /api/admin/cms/menu/items|categories|pdfs|upload-image|upload-pdf
 */
import PageHeader from "@/components/shared/PageHeader";
import { useState, useEffect } from "react";
import { UtensilsCrossed, FileText, Tag, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import api from "@/lib/api";

import ItemsTab from "./ItemsTab";
import CategoriesTab from "./CategoriesTab";
import PdfTab from "./PdfTab";

export default function CMSMenu() {
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("items");

  useEffect(() => {
    async function loadBrands() {
      try {
        const r = await api.get("/admin/cms/brands");
        const data = r.data?.data || [];
        setBrands(data);
        if (data.length > 0) setSelectedBrandId(data[0].id);
      } catch { toast.error("Gagal memuat brands"); }
      finally { setBrandsLoading(false); }
    }
    loadBrands();
  }, []);

  return (
    <div className="space-y-3" data-testid="cms-emenu-page">
      {/* Di dalam CMS Studio, PageHeader mengisi subtitle & aksi header hub (DESIGN_SYSTEM §10.1). */}
      <PageHeader
        title="Menu items"
        subtitle="Kelola menu items, kategori, dan PDF per brand untuk ditampilkan di website."
        actions={<>
          <div className="flex items-center gap-2" data-testid="admin-menu-brand-group">
            <Label htmlFor="cms-menu-brand" className="text-xs md:text-sm font-medium whitespace-nowrap">Brand</Label>
            {brandsLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : (
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger id="cms-menu-brand" className="w-44" data-testid="brand-selector">
                  <SelectValue placeholder="Pilih brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2">
                        {b.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />}
                        {b.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </>}
      />

      {!selectedBrandId && !brandsLoading && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Pilih brand terlebih dahulu untuk mengelola menu.
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="admin-menu-tabs">
          <TabsTrigger value="items" data-testid="tab-items">
            <UtensilsCrossed /> Items
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">
            <Tag /> Kategori
          </TabsTrigger>
          <TabsTrigger value="pdf" data-testid="tab-pdf">
            <FileText /> PDF menu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <ItemsTab brands={brands} selectedBrandId={selectedBrandId} onBrandChange={setSelectedBrandId} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab brands={brands} selectedBrandId={selectedBrandId} />
        </TabsContent>
        <TabsContent value="pdf">
          <PdfTab brands={brands} selectedBrandId={selectedBrandId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
