/** CMSMenu/index.jsx — CMSMenu orchestrator. */
/**
 * CMS E-Menu — Admin CMS for managing brand menu items, categories, and PDF menus.
 * Uses new admin_menu.py API: /api/admin/cms/menu/items|categories|pdfs|upload-image|upload-pdf
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Edit2, Trash2, UtensilsCrossed, Upload, FileText,
  Tag, Image as ImageIcon, Loader2, X, ChevronDown, Eye, EyeOff,
  Download, Star, AlertCircle, Search, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    <div className="space-y-4" data-testid="cms-emenu-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold">E-Menu Management</h3>
          <p className="text-sm text-muted-foreground">
            Kelola menu items, kategori, dan PDF per brand untuk ditampilkan di website.
          </p>
        </div>
        <div className="flex items-center gap-3" data-testid="admin-menu-brand-group">
          <Label className="text-sm font-medium whitespace-nowrap">Brand:</Label>
          {brandsLoading ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
              <SelectTrigger className="w-44" data-testid="brand-selector">
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
      </div>

      {!selectedBrandId && !brandsLoading && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Pilih brand terlebih dahulu untuk mengelola menu.
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-sm" data-testid="admin-menu-tabs">
          <TabsTrigger value="items" data-testid="tab-items">
            <UtensilsCrossed className="h-4 w-4 mr-1.5" /> Items
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">
            <Tag className="h-4 w-4 mr-1.5" /> Kategori
          </TabsTrigger>
          <TabsTrigger value="pdf" data-testid="tab-pdf">
            <FileText className="h-4 w-4 mr-1.5" /> PDF Menu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <ItemsTab brands={brands} selectedBrandId={selectedBrandId} onBrandChange={setSelectedBrandId} />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab brands={brands} selectedBrandId={selectedBrandId} />
        </TabsContent>
        <TabsContent value="pdf" className="mt-4">
          <PdfTab brands={brands} selectedBrandId={selectedBrandId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
