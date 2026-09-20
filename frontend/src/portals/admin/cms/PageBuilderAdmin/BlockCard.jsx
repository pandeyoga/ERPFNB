/** PageBuilder/BlockCard.jsx — individual block card in the page builder. */
/**
 * PageBuilder — Sprint L: Flexible content page builder
 * Block-based custom pages with multiple block types.
 */
import { useState, useEffect } from "react";
import {
  Plus, Trash2, Edit2, Eye, EyeOff, Globe, Loader2, ChevronUp, ChevronDown,
  Save, Image, Type, Megaphone, Minus, LayoutTemplate, ExternalLink, Copy, RefreshCw, X,
  Images, UtensilsCrossed
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api from "@/lib/api";
import ImageUpload from "@/components/shared/ImageUpload";
import RichTextEditor from "@/components/shared/RichTextEditor";
import CMSSEOFields from "../CMSSEOFields";

import { BLOCK_EDITORS } from "./BlockEditors";
import { BLOCK_TYPES } from "./constants";

function BlockCard({ block, index, total, onChange, onDelete, onMoveUp, onMoveDown }) {
  const [expanded, setExpanded] = useState(true);
  const cfg = BLOCK_TYPES.find(b => b.id === block.type);
  const Icon = cfg?.icon || Type;
  const Editor = BLOCK_EDITORS[block.type];

  return (
    <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Block header */}
      <div className="flex items-center gap-2 p-3 bg-muted/30 border-b cursor-pointer"
           onClick={() => setExpanded(v => !v)}>
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-sm flex-1">{cfg?.label || block.type}</span>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveUp} disabled={index === 0}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveDown} disabled={index === total - 1}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {/* Block editor */}
      {expanded && Editor && (
        <div className="p-4">
          <Editor block={block} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// ── Main PageBuilder component ───────────────────────────────────────────────

export default BlockCard;
