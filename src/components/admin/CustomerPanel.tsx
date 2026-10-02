"use client";

import { useEffect, useState } from "react";
import { formatDateTime, initialsFor } from "@/lib/format";
import type { Conversation, ConversationPriority, Tag } from "@/components/admin/types";

type Note = { id: number; agentName: string | null; text: string; createdAt: number };
type RosterAgent = { id: string; name: string };

const PRIORITY_OPTIONS: { key: ConversationPriority; label: string; className: string }[] = [
  { key: "low", label: "Low", className: "text-text-faint" },
  { key: "normal", label: "Normal", className: "text-text-dim" },
  { key: "high", label: "High", className: "text-amber-600" },
  { key: "urgent", label: "Urgent", className: "text-red-600" },
];

export function CustomerPanel({
  conversation,
  tags,
  roster,
  onClose,
  onSetPriority,
  onAssign,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: {
  conversation: Conversation;
  tags: Tag[];
  roster: RosterAgent[];
  onClose?: () => void;
  onSetPriority: (visitorId: string, priority: ConversationPriority) => void;
  onAssign: (visitorId: string, agentId: string | null) => void;
  onAddTag: (visitorId: string, tagId: number) => void;
  onRemoveTag: (visitorId: string, tagId: number) => void;
  onCreateTag: (name: string) => Promise<Tag | null>;
}) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the notes thread when switching conversations
    setNotes(null);
    fetch(`/api/agent/conversation/notes?visitorId=${conversation.visitorId}`)
      .then((res) => res.json())
      .then((data: { notes: Note[] }) => setNotes(data.notes))
      .catch(() => setNotes([]));
  }, [conversation.visitorId]);

  async function addNote() {
    const text = noteDraft.trim();
    if (!text) return;
    setNoteDraft("");
    const res = await fetch("/api/agent/conversation/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: conversation.visitorId, text }),
    });
    const data = await res.json().catch(() => null);
    if (data?.note) setNotes((prev) => [...(prev ?? []), data.note]);
  }

  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    const tag = await onCreateTag(name);
    if (tag) onAddTag(conversation.visitorId, tag.id);
    setNewTagName("");
  }

  const conversationTags = tags.filter((t) => conversation.tagIds.includes(t.id));
  const assignedAgent = roster.find((a) => a.id === conversation.assignedAgentId);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto border-l border-border bg-panel p-4 md:w-80">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Customer details</p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close panel" className="text-text-faint hover:text-accent-bright md:hidden">
            ✕
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-border text-sm font-medium text-text-dim">
          {initialsFor(conversation.visitorName ?? conversation.visitorId)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {conversation.visitorName ?? "Guest"}
          </p>
          {conversation.visitorEmail && <p className="truncate text-xs text-text-dim">{conversation.visitorEmail}</p>}
        </div>
      </div>

      <dl className="mb-4 space-y-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-text-faint">Ticket</dt>
          <dd className="text-text-dim">#{conversation.ticketNo}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-text-faint">Started</dt>
          <dd className="text-text-dim">{formatDateTime(conversation.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-text-faint">Last activity</dt>
          <dd className="text-text-dim">{formatDateTime(conversation.lastMessageAt)}</dd>
        </div>
      </dl>

      <div className="mb-4">
        <p className="mb-1.5 text-xs font-medium text-text-dim">Priority</p>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSetPriority(conversation.visitorId, opt.key)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                conversation.priority === opt.key ? "border-accent bg-accent/10" : "border-border"
              } ${opt.className}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-xs font-medium text-text-dim">Assigned agent</p>
        <select
          value={conversation.assignedAgentId ?? ""}
          onChange={(e) => onAssign(conversation.visitorId, e.target.value || null)}
          aria-label="Assigned agent"
          className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-xs"
        >
          <option value="">Unassigned</option>
          {roster.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {assignedAgent && <p className="mt-1 text-[10px] text-text-faint">Currently: {assignedAgent.name}</p>}
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-medium text-text-dim">Tags</p>
          <button type="button" onClick={() => setShowTagPicker((v) => !v)} className="text-[11px] text-accent-bright hover:underline">
            {showTagPicker ? "Done" : "+ Add"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {conversationTags.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button type="button" onClick={() => onRemoveTag(conversation.visitorId, tag.id)} aria-label={`Remove ${tag.name} tag`} className="opacity-80 hover:opacity-100">
                ✕
              </button>
            </span>
          ))}
          {conversationTags.length === 0 && <p className="text-[11px] text-text-faint">No tags yet</p>}
        </div>
        {showTagPicker && (
          <div className="mt-2 space-y-2 rounded-xl border border-border p-2">
            <div className="flex flex-wrap gap-1.5">
              {tags
                .filter((t) => !conversation.tagIds.includes(t.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onAddTag(conversation.visitorId, tag.id)}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-text-dim hover:border-accent/40"
                  >
                    {tag.name}
                  </button>
                ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name"
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px]"
              />
              <button type="button" onClick={handleCreateTag} className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] text-white">
                Create
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-text-dim">Internal notes</p>
        <p className="mb-2 text-[10px] text-text-faint">Never visible to the customer</p>
        <div className="mb-2 space-y-1.5">
          {notes === null && <p className="text-[11px] text-text-faint">Loading…</p>}
          {notes?.length === 0 && <p className="text-[11px] text-text-faint">No notes yet</p>}
          {notes?.map((note) => (
            <div key={note.id} className="rounded-lg bg-panel-raised px-2.5 py-2 text-[11px]">
              <p className="text-foreground">{note.text}</p>
              <p className="mt-1 text-text-faint">{note.agentName} · {formatDateTime(note.createdAt)}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Add an internal note…"
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-xl border border-border bg-background px-2.5 py-1.5 text-[11px]"
          />
          <button type="button" onClick={addNote} className="shrink-0 self-end rounded-full bg-accent px-3 py-1.5 text-[11px] text-white">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
