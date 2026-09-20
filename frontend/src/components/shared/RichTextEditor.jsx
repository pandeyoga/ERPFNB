/**
 * RichTextEditor — TipTap WYSIWYG component
 * Features: Bold, Italic, Underline, Headings, Lists, Links,
 *           Blockquote, Code, Horizontal Rule, Text Align, Undo/Redo
 */
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading2, Heading3, List, ListOrdered, Quote, Code2,
  Link2, AlignLeft, AlignCenter, AlignRight, Minus,
  RotateCcw, RotateCw, Link2Off,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ── Toolbar button helper ──────────────────────────────────────────────────
function ToolBtn({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded text-sm transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "opacity-30 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

// ── Link dialog state ──────────────────────────────────────────────────────
function setLink(editor) {
  const prev = editor.getAttributes("link").href || "";
  const url = window.prompt("URL Link:", prev);
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function RichTextEditor({ value, onChange, placeholder = "Tulis konten di sini...", minHeight = 220, className }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3",
          `min-h-[${minHeight}px]`,
        ),
      },
    },
    onUpdate({ editor: e }) {
      onChange?.(e.getHTML());
    },
  });

  // Sync external value (e.g. when form is reset/loaded)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== undefined && value !== current) {
      editor.commands.setContent(value || "", false);
    }
  }, [value]); // eslint-disable-line

  if (!editor) return null;

  const e = editor;

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden bg-background", className)} data-testid="rich-text-editor">
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30">
        {/* History */}
        <ToolBtn title="Undo" onClick={() => e.chain().focus().undo().run()} disabled={!e.can().undo()}>
          <RotateCcw className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Redo" onClick={() => e.chain().focus().redo().run()} disabled={!e.can().redo()}>
          <RotateCw className="h-3.5 w-3.5" />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Inline marks */}
        <ToolBtn title="Bold" active={e.isActive("bold")} onClick={() => e.chain().focus().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Italic" active={e.isActive("italic")} onClick={() => e.chain().focus().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Underline" active={e.isActive("underline")} onClick={() => e.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Strikethrough" active={e.isActive("strike")} onClick={() => e.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Headings */}
        <ToolBtn title="Heading 2" active={e.isActive("heading", { level: 2 })} onClick={() => e.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Heading 3" active={e.isActive("heading", { level: 3 })} onClick={() => e.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-3.5 w-3.5" />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <ToolBtn title="Bullet List" active={e.isActive("bulletList")} onClick={() => e.chain().focus().toggleBulletList().run()}>
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Numbered List" active={e.isActive("orderedList")} onClick={() => e.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Block */}
        <ToolBtn title="Blockquote" active={e.isActive("blockquote")} onClick={() => e.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Code Block" active={e.isActive("codeBlock")} onClick={() => e.chain().focus().toggleCodeBlock().run()}>
          <Code2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Divider" onClick={() => e.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-3.5 w-3.5" />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Alignment */}
        <ToolBtn title="Align Left" active={e.isActive({ textAlign: "left" })} onClick={() => e.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Align Center" active={e.isActive({ textAlign: "center" })} onClick={() => e.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn title="Align Right" active={e.isActive({ textAlign: "right" })} onClick={() => e.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="h-3.5 w-3.5" />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Link */}
        <ToolBtn title="Set Link" active={e.isActive("link")} onClick={() => setLink(e)}>
          <Link2 className="h-3.5 w-3.5" />
        </ToolBtn>
        {e.isActive("link") && (
          <ToolBtn title="Remove Link" onClick={() => e.chain().focus().unsetLink().run()}>
            <Link2Off className="h-3.5 w-3.5" />
          </ToolBtn>
        )}
      </div>

      {/* ── Editor Content ──────────────────────────────────────── */}
      <EditorContent editor={editor} />

      {/* ── Word/char count ──────────────────────────────────────── */}
      <div className="px-3 py-1.5 border-t border-border text-xs text-muted-foreground flex justify-end">
        {e.storage.characterCount?.characters?.() ?? 0} karakter
      </div>
    </div>
  );
}
