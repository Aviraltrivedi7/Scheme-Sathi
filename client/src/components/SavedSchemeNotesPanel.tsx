import { Bookmark, CalendarClock, ExternalLink, Loader2, Pencil, Save, Search, StickyNote, Trash2, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import "./SavedSchemeNotesPanel.css";

const updatedFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function SavedSchemeNotesPanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const deferredQuery = useDeferredValue(query);
  const input = useMemo(
    () => ({ query: deferredQuery.trim() || undefined }),
    [deferredQuery]
  );
  const notesQuery = trpc.saved.notes.useQuery(input, { retry: false });
  const notes = notesQuery.data?.notes ?? [];
  const categories = useMemo(
    () => Array.from(new Set(notes.map(note => note.category))).sort(),
    [notes]
  );
  const visibleNotes = useMemo(
    () => notes.filter(note => category === "all" || note.category === category),
    [notes, category]
  );
  const saveNote = trpc.saved.upsertNote.useMutation({
    onSuccess: async () => {
      setEditingSchemeId(null);
      await utils.saved.notes.invalidate();
    },
  });
  const deleteNote = trpc.saved.deleteNote.useMutation({
    onSuccess: async () => {
      setEditingSchemeId(null);
      await utils.saved.notes.invalidate();
    },
  });

  return (
    <section className="saved-scheme-notes-panel" aria-labelledby="saved-scheme-notes-title">
      <header>
        <div>
          <span className="desk-kicker"><StickyNote size={14} /> SAVED SCHEME NOTES</span>
          <h2 id="saved-scheme-notes-title">Keep your scheme follow-ups visible.</h2>
          <p>Only notes saved from your Scheme Sathi account appear here.</p>
        </div>
        <span className="saved-notes-count"><Bookmark size={14} /> {notes.length} saved</span>
      </header>
      <div className="saved-notes-filters">
        <label className="saved-notes-search">
          <Search size={15} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search scheme names or your notes" aria-label="Search saved scheme notes" />
        </label>
        <select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter saved notes by category">
          <option value="all">All categories</option>
          {categories.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {notesQuery.isLoading ? <div className="saved-notes-state"><Loader2 className="spin" size={18} /> Loading your private notes…</div> : null}
      {!notesQuery.isLoading && !visibleNotes.length ? <div className="saved-notes-state empty"><StickyNote size={19} /><div><strong>{notes.length ? "No saved notes match this filter." : "No saved scheme notes yet."}</strong><span>{notes.length ? "Try a different phrase or category." : "Save a scheme, then add a personal note from its details page."}</span></div></div> : null}
      <div className="saved-notes-grid">
        {visibleNotes.map(note => <article key={note.schemeId}>
          <div className="saved-note-card-heading"><span>{note.category}</span><time>{updatedFormat.format(new Date(note.updatedAt))}</time></div>
          <h3><button className="saved-note-scheme-link" onClick={() => setLocation(`/scheme/${encodeURIComponent(note.schemeId)}`)}>{note.schemeName}<ExternalLink size={13} /></button></h3>
          {editingSchemeId === note.schemeId ? <textarea value={draftNote} maxLength={4000} onChange={event => setDraftNote(event.target.value)} aria-label={`Edit note for ${note.schemeName}`} /> : <p>{note.note}</p>}
          {note.applicationDeadline ? <small><CalendarClock size={13} /> Deadline {updatedFormat.format(new Date(note.applicationDeadline))}</small> : <small><CalendarClock size={13} /> Check official portal for dates</small>}
          <div className="saved-note-actions">
            {editingSchemeId === note.schemeId ? <>
              <button className="saved-note-save" disabled={!draftNote.trim() || saveNote.isPending} onClick={() => saveNote.mutate({ schemeId: note.schemeId, note: draftNote })}><Save size={13} /> {saveNote.isPending ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditingSchemeId(null)}><X size={13} /> Cancel</button>
            </> : <>
              <button onClick={() => { setDraftNote(note.note); setEditingSchemeId(note.schemeId); }}><Pencil size={13} /> Edit</button>
              <button className="saved-note-delete" disabled={deleteNote.isPending} onClick={() => deleteNote.mutate({ schemeId: note.schemeId })}><Trash2 size={13} /> Delete</button>
            </>}
          </div>
        </article>)}
      </div>
    </section>
  );
}
