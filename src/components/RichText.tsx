"use client";

import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

export function RichText({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Add a little context, a link, or a note…",
      }),
    ],
    content: value,
    immediatelyRender: false,
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "rich-content",
        "aria-label": readOnly ? "Notes" : "Rich text notes",
      },
    },
  });
  const formatting = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
    }),
  });
  useEffect(() => {
    if (editor && editor.getHTML() !== value)
      editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);
  return (
    <div className={`rich-editor ${readOnly ? "read-only" : ""}`}>
      {!readOnly && editor && (
        <div className="rich-toolbar">
          <button
            type="button"
            aria-label="Bold"
            aria-pressed={formatting?.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <b>B</b>
          </button>
          <button
            type="button"
            aria-label="Italic"
            aria-pressed={formatting?.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <i>I</i>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            List
          </button>
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            Heading
          </button>
          <button
            type="button"
            onClick={() => {
              const url = window.prompt("Link URL (https://…)");
              if (url && /^https?:\/\//i.test(url))
                editor.chain().focus().setLink({ href: url }).run();
            }}
          >
            Link
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
