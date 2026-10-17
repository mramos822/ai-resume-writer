// src/components/UploadedItems.tsx
"use client";

import { dndAccessibility } from "@/i18n/dnd";
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  } from "react";
import { useAuth } from "@/context/authContext";
import { useProfile } from "@/context/profileContext";
import { useDialog } from "@/context/dialogContext";
import { useToast } from "@/context/toastContext";
import { Button } from "@/components/ui/button";
import {
  List,
  Grid as GridIcon,
  File as FileIcon,
  FileText,
  X,
  GripVertical,
  Wand2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import * as mammoth from "mammoth";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useT, useLocaleTag } from "@/i18n/provider";

type UploadedRecord = {
  id: string;
  filename: string;
  createdAt: string; // ISO timestamp
  type: string;
  order?: number;
};

// Which files this browser has already read into the profile (the server does not keep that): they get a "Read" mark.
const READ_KEY = "kaizo:read-uploads";
const readIds = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(READ_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const markRead = (id: string) => {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...new Set([...readIds(), id])].slice(-200)));
  } catch {
    /* storage blocked: the mark is only for this visit */
  }
};

// The sort bar is only worth its room when there are enough files to sort.
const SORT_FROM = 4;

type SortBy = "order" | "name" | "date" | "type";
type SortDir = "asc" | "desc";

function SortableTile(props: {
  record: UploadedRecord;
  fmt: (iso: string) => string;
  onClick: (r: UploadedRecord) => void;
  onDelete: (id: string) => void;
  getTypeLabel: (m: string, f: string) => string;
  viewMode: "list" | "icon";
  token: string;
  onParse: (id: string) => void;
  isParsing: boolean;
  /** the name to show (two files with the same name get " (2)", " (3)"...) */
  label: string;
  isRead: boolean;
}) {
  const { tr } = useT();
  const {
    record: it,
    fmt,
    onClick,
    onDelete,
    getTypeLabel,
    viewMode,
    onParse,
    isParsing,
    label,
    isRead,
  } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: it.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    cursor: isDragging ? "grabbing" : "grab",
  };

  const dialog = useDialog();
  const deleteBtn = (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await dialog.confirm({
          title: tr("Delete “{filename}”?", { filename: it.filename }),
          description: tr("The file is removed from your uploads. Details already imported into your profile are kept."),
          confirmText: tr("Delete file"),
          tone: "danger",
        });
        if (ok) onDelete(it.id);
      }}
      aria-label={tr("Delete “{filename}”?", { filename: label })}
      title={tr("Delete file")}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      <X className="h-4 w-4" />
    </button>
  );

  const parseBtn = (
    <Button
      size="sm"
      variant="outline"
      disabled={isParsing}
      aria-label={isParsing ? tr("Reading…") : tr("Fill my profile from “{filename}”", { filename: label })}
      className="gap-1.5"
      onClick={(e) => {
        e.stopPropagation();
        onParse(it.id);
      }}
    >
      {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
      <span className="max-sm:sr-only">{isParsing ? tr("Reading…") : isRead ? tr("Read again") : tr("Fill my profile")}</span>
    </Button>
  );

  if (viewMode === "list") {
    return (
      <li
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={() => onClick(it)}
        style={style}
        className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted"
      >
        <div {...attributes} {...listeners} title={tr("Drag to move this section")} className="hidden cursor-grab p-1 hover:text-blue-400 sm:block">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-500">
          {it.type.startsWith("text/") ? <FileText className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{label}</p>
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-semibold uppercase tracking-wide">{getTypeLabel(it.type, it.filename)}</span>
            <span className="truncate">{fmt(it.createdAt)}</span>
            {isRead && (
              <span className="inline-flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {tr("Read")}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {parseBtn}
          {deleteBtn}
        </div>
      </li>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onClick(it)}
      style={style}
      className="relative flex cursor-pointer flex-col items-center rounded-xl border bg-card p-4 text-center transition-colors hover:bg-muted"
    >
      <div className="absolute right-1.5 top-1.5">{deleteBtn}</div>
      <span className="mt-2 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/10 text-blue-500">
        {it.type.startsWith("text/") ? <FileText className="h-7 w-7" /> : <FileIcon className="h-7 w-7" />}
      </span>
      <p className="mt-3 w-full truncate text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-semibold uppercase tracking-wide">{getTypeLabel(it.type, it.filename)}</span>
        <span>{fmt(it.createdAt)}</span>
      </p>
      {isRead && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {tr("Read")}
        </p>
      )}
      <div className="mt-3">{parseBtn}</div>
    </div>
  );
}

export default function UploadedItems() {
  const { tr } = useT();
  const tag = useLocaleTag();
  const { user, loading } = useAuth();
  const { parseFile } = useProfile();
  const toast = useToast();
  const [items, setItems] = useState<UploadedRecord[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "icon">("list");
  const [token, setToken] = useState<string>("");

  const [sortBy, setSortBy] = useState<SortBy>("order");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selected, setSelected] = useState<UploadedRecord | null>(null);
  const [previewMode, setPreviewMode] = useState<
    "pdf" | "docx" | "md" | "text" | "other" | null
  >(null);
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // track which file is currently being parsed
  const [parsingId, setParsingId] = useState<string | null>(null);
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => setRead(readIds()), []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const getTypeLabel = (mime: string, filename: string) => {
    // Label biography/freeform uploads as FREEFORM
    if (
      mime === "text/plain" &&
      (filename.toLowerCase() === "biography.txt" || filename.toLowerCase().includes("biography") || filename.toLowerCase().includes("freeform"))
    ) {
      return "FREEFORM";
    }
    // Label .txt files as TXT (but not biography)
    if (mime === "text/plain" && filename.toLowerCase().endsWith(".txt")) {
      return "TXT";
    }
    if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return "docx";
    }
    return mime.split("/")[1] || mime;
  };
  const fmt = (iso: string) => new Date(iso).toLocaleString(tag, { dateStyle: "medium", timeStyle: "short" });

  // Fetch uploads
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    if (!token) return;
    let tried = false;
    const fetchUploads = async () => {
      const res = await fetch("/api/uploads", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 && !tried) {
        tried = true;
        const fresh = await user.getIdToken(true);
        setToken(fresh);
        return;
      }
      if (!res.ok) return console.error("fetchUploads failed", res.status);
      const data = (await res.json()) as UploadedRecord[];
      setItems(data.map((f) => ({ ...f, createdAt: new Date(f.createdAt).toISOString() })));
    };
    fetchUploads();
    // it refreshes when the person comes back to the tab, and every 30 seconds while the tab is in sight (not every 5, and never hidden)
    const refresh = () => document.visibilityState === "visible" && fetchUploads();
    const iv = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, token]);

  useEffect(() => {
    if (user) user.getIdToken().then(setToken);
  }, [user]);

  const sortedItems = React.useMemo(() => {
    if (sortBy === "order") return sortDir === "asc" ? items : [...items].reverse();
    const arr = [...items];
    let cmp: (a: UploadedRecord, b: UploadedRecord) => number;
    if (sortBy === "name") cmp = (a, b) => a.filename.localeCompare(b.filename);
    else if (sortBy === "type")
      cmp = (a, b) => getTypeLabel(a.type, a.filename).localeCompare(getTypeLabel(b.type, b.filename));
    else cmp = (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    arr.sort((a, b) => (sortDir === "asc" ? cmp(a, b) : -cmp(a, b)));
    return arr;
  }, [items, sortBy, sortDir]);

  // two files with the same name are told apart: the older one keeps its name, the next one is "name (2)"...
  const labels = React.useMemo(() => {
    const seen = new Map<string, number>();
    const out = new Map<string, string>();
    for (const it of [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
      const n = (seen.get(it.filename) ?? 0) + 1;
      seen.set(it.filename, n);
      out.set(it.id, n === 1 ? it.filename : it.filename.replace(/(\.[^.]+)?$/, ` (${n})$1`));
    }
    return out;
  }, [items]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = sortedItems.findIndex((i) => i.id === active.id);
        const newIndex = sortedItems.findIndex((i) => i.id === over.id);
        const next = arrayMove(sortedItems, oldIndex, newIndex);
        setItems(next);
        fetch("/api/uploads/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orderedIds: next.map((i) => i.id) }),
        }).catch(console.error);
      }
    },
    [sortedItems, token]
  );

  const handleDelete = useCallback(
    (id: string) => {
      fetch(`/api/uploads?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        if (res.ok) setItems((prev) => prev.filter((f) => f.id !== id));
      });
    },
    [token]
  );

  const handleParse = useCallback(
    (id: string) => {
      setParsingId(id);
      parseFile(id)
        .then(() => {
          markRead(id);
          setRead(readIds());
        })
        .catch((err) =>
          toast.error(tr("We couldn't read that file: {message}. Try again, or paste the text in Write Biography.", { message: err.message }))
        )
        .finally(() => setParsingId(null));
    },
    [parseFile, toast, tr]
  );

  // A file that was just uploaded is read into the profile automatically
  const parseRef = useRef(handleParse);
  parseRef.current = handleParse;
  useEffect(() => {
    const onUploaded = (e: Event) => {
      const id = (e as CustomEvent<{ fileId?: string }>).detail?.fileId;
      if (id) parseRef.current(id);
    };
    window.addEventListener("kaizo:file-uploaded", onUploaded);
    return () => window.removeEventListener("kaizo:file-uploaded", onUploaded);
  }, []);

  const openItem = async (it: UploadedRecord) => {
    if (!user) return;
    setSelected(it);
    setLoadingContent(true);
    setTextContent(null);
    setContentUrl(null);

    const downloadUrl = `/api/download?id=${encodeURIComponent(it.id)}&type=upload&token=${encodeURIComponent(token)}`;
    setContentUrl(downloadUrl);
    const res = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return setLoadingContent(false);

    const blob = await res.blob();
    const previewMap: Record<string, "pdf" | "docx" | "md" | "text"> = {
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "text/markdown": "md",
      "text/plain": "text",
    };
    const mode = previewMap[it.type] ?? (it.type.startsWith("text/") ? "text" : "other");
    setPreviewMode(mode);

    if (mode === "docx") {
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
      setTextContent(value);
    } else if (mode === "md" || mode === "text") {
      setTextContent(await blob.text());
    }
    setLoadingContent(false);
  };

  const closeModal = () => {
    setSelected(null);
    setPreviewMode(null);
    setTextContent(null);
    if (contentUrl) URL.revokeObjectURL(contentUrl);
    setContentUrl(null);
  };

  if (loading) return null;

  return (
    <div>
      {/* header + toggle */}
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-base font-bold text-foreground sm:text-lg">
          {tr("Your uploads")}
          {items.length > 0 && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{items.length}</span>}
        </h4>
        <div className="hidden gap-1 sm:flex">
          <Button variant="ghost" size="icon" aria-label={tr("List view")} aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}>
            <List className={`h-5 w-5 ${viewMode === "list" ? "text-blue-600" : "text-muted-foreground"}`} />
          </Button>
          <Button variant="ghost" size="icon" aria-label={tr("Grid view")} aria-pressed={viewMode === "icon"} onClick={() => setViewMode("icon")}>
            <GridIcon className={`h-5 w-5 ${viewMode === "icon" ? "text-blue-600" : "text-muted-foreground"}`} />
          </Button>
        </div>
      </div>

      {/* SORT BAR: only when there are enough files to be worth sorting */}
      {items.length >= SORT_FROM && (
        <div className="mb-4 hidden items-center gap-2 sm:flex">
          <span className="text-sm text-muted-foreground">{tr("Sort by:")}</span>
          <select
            aria-label={tr("Sort by:")}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-md border bg-card px-2 py-1 text-sm text-foreground"
          >
            <option value="order">{tr("Order")}</option>
            <option value="name">{tr("Name")}</option>
            <option value="date">{tr("Date")}</option>
            <option value="type">{tr("Type")}</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label={sortDir === "asc" ? tr("Ascending") : tr("Descending")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card text-sm text-foreground"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      )}

      <DndContext accessibility={dndAccessibility(tr)} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedItems.map((i) => i.id)} strategy={viewMode === "list" ? verticalListSortingStrategy : rectSortingStrategy}>
          {viewMode === "list" ? (
            <ul className="space-y-2">
              {sortedItems.map((it) => (
                <SortableTile
                  key={it.id}
                  record={it}
                  fmt={fmt}
                  onClick={openItem}
                  onDelete={handleDelete}
                  onParse={handleParse}
                  getTypeLabel={getTypeLabel}
                  viewMode="list"
                  token={token}
                  isParsing={parsingId === it.id}
                  label={labels.get(it.id) ?? it.filename}
                  isRead={read.includes(it.id)}
                />
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sortedItems.map((it) => (
                <SortableTile
                  key={it.id}
                  record={it}
                  fmt={fmt}
                  onClick={openItem}
                  onDelete={handleDelete}
                  onParse={handleParse}
                  getTypeLabel={getTypeLabel}
                  viewMode="icon"
                  token={token}
                  isParsing={parsingId === it.id}
                  label={labels.get(it.id) ?? it.filename}
                  isRead={read.includes(it.id)}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>

      {selected && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-[70]">
          <div className="bg-card max-w-3xl w-full max-h-[80vh] overflow-auto rounded-lg p-6 relative">
            <button onClick={closeModal} aria-label={tr("Close")} className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
              <X className="h-6 w-6" />
            </button>

            <h2 className="text-xl font-semibold text-foreground mb-4">
              <a href={contentUrl!} download={selected.filename} className="text-blue-600 underline">
                {selected.filename}
              </a>
            </h2>

            {loadingContent ? (
              <p className="text-muted-foreground">{tr("Opening your file…")}</p>
            ) : previewMode === "pdf" ? (
              <iframe src={contentUrl!} className="w-full h-[70vh] border" title={selected.filename} />
            ) : previewMode === "docx" ? (
              <div className="prose prose-invert max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: textContent! }} />
            ) : previewMode === "md" ? (
              <div className="prose prose-invert overflow-auto text-foreground">
                <ReactMarkdown>{textContent!}</ReactMarkdown>
              </div>
            ) : previewMode === "text" ? (
              <pre className="whitespace-pre-wrap text-foreground">{textContent}</pre>
            ) : (
              <p className="text-muted-foreground">{tr("No preview available.")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
