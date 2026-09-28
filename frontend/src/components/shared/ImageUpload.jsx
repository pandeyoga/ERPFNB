import { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import MediaPickerModal from "@/components/shared/MediaPickerModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

function resolveUrl(url) {
  if (!url) return "";
  if (url.startsWith("/")) return `${BACKEND_URL}${url}`;
  return url;
}

/**
 * ImageUpload Component (Sprint II enhanced)
 *
 * Allows users to:
 * 1. Upload an image file
 * 2. Paste an image URL directly
 * 3. Pick from Media Library  ← NEW
 */
export default function ImageUpload({ label, value, onChange, required = false }) {
  const [uploading, setUploading] = useState(false);
  const [inputMode, setInputMode] = useState(value && value.startsWith("http") ? "url" : "upload");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please select an image file (JPEG, PNG, or WebP)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be less than 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("/admin/cms/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const imageUrl = response.data?.data?.url;
      if (imageUrl) {
        onChange(resolveUrl(imageUrl));
        toast({ title: "Upload berhasil", description: "Gambar diupload" });
      }
    } catch (error) {
      toast({ title: "Upload gagal", description: error.response?.data?.errors?.[0]?.message || "Gagal upload gambar", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClear = () => {
    onChange("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePickFromLibrary = (url) => {
    onChange(resolveUrl(url));
  };

  const previewSrc = resolveUrl(value);

  return (
    <div className="space-y-2" data-testid="image-upload-component">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="flex gap-1.5">
          {/* Mode toggles */}
          {["upload", "url"].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setInputMode(mode)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                inputMode === mode
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid={`toggle-${mode}-mode`}
            >
              {mode === "upload" ? "Upload" : "URL"}
            </button>
          ))}
          {/* Media Library picker */}
          <button
            type="button"
            onClick={() => setMediaPickerOpen(true)}
            className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
              inputMode === "library"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid="toggle-library-mode"
          >
            <Library className="h-3 w-3" />
            Library
          </button>
        </div>
      </div>

      {inputMode === "upload" ? (
        <div
          className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          data-testid="upload-dropzone"
        >
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" disabled={uploading} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : value ? (
            <div className="flex flex-col items-center gap-2">
              <ImageIcon className="h-8 w-8 text-green-600" />
              <p className="text-sm font-medium">Gambar diupload</p>
              <p className="text-xs text-muted-foreground">Klik untuk ganti</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm">Klik untuk upload atau drag &amp; drop</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WebP maks 5MB</p>
            </div>
          )}
        </div>
      ) : (
        <Input
          type="url"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/image.jpg"
          required={required}
          data-testid="image-url-input"
        />
      )}

      {value && (
        <div className="space-y-1.5">
          <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30">
            <img
              src={previewSrc}
              alt="Preview"
              className="w-full h-40 object-cover"
              onError={(e) => { e.target.src = "https://via.placeholder.com/400x200?text=No+Image"; }}
              data-testid="image-preview"
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-full shadow hover:bg-background transition-colors"
              data-testid="clear-image-button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground truncate">{value}</p>
        </div>
      )}

      {/* Media Picker Modal */}
      <MediaPickerModal
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handlePickFromLibrary}
      />
    </div>
  );
}
