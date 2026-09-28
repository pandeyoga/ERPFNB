/** CMSMenu/helpers.js — shared constants + helpers. */
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


const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

const DIETARY_OPTIONS = [
  { value: "vegetarian", label: "Vegetarian", color: "#4CAF50" },
  { value: "vegan", label: "Vegan", color: "#2E7D32" },
  { value: "gluten-free", label: "Gluten Free", color: "#FF9800" },
  { value: "halal", label: "Halal", color: "#00BCD4" },
  { value: "spicy", label: "Spicy", color: "#F44336" },
  { value: "signature", label: "Signature", color: "#9C27B0" },
  { value: "bestseller", label: "Bestseller", color: "#FF5722" },
];

const EMPTY_ITEM = {
  brand_id: "", name: "", description: "", price: "",
  category: "", dietary_tags: [], image_url: "",
  is_featured: false, is_available: true, sort_order: 0,
};

const EMPTY_CAT = { brand_id: "", name: "", description: "", sort_order: 0 };

function formatCurrency(n) {
  return `Rp ${(n || 0).toLocaleString("id-ID")}`;
}

function MenuImage({ src, alt, className = "" }) {
  const [err, setErr] = useState(false);
  const fullUrl = src && src.startsWith("/") ? `${BACKEND_URL}${src}` : src;
  if (!src || err) {
    return (
      <div className={`bg-muted flex items-center justify-center ${className}`}>
        <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <img src={fullUrl} alt={alt} className={`object-cover ${className}`}
      onError={() => setErr(true)} loading="lazy" decoding="async" />
  );
}

// =================== ITEMS TAB ===================

export { BACKEND_URL, formatCurrency, MenuImage, DIETARY_OPTIONS, EMPTY_ITEM, EMPTY_CAT };
