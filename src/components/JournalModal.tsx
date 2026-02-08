import { useState, useEffect, useRef } from 'react';
import { X, Save, Trash2, BookOpen, PenLine, Loader2 } from 'lucide-react';
import { useToast } from './Toast';
import { getEntryByDate, saveEntry, deleteEntry } from '../lib/database';
import type { Profile, JournalEntry } from '../types';

interface JournalModalProps {
  date: string;
  currentUserId: string;
  viewingUserId: string;
  currentProfile: Profile;
  viewingProfile: Profile | null;
  partnerProfile: Profile | null;
  onClose: () => void;
  onSaved: () => void;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function JournalModal({
  date,
  currentUserId,
  viewingUserId,
  currentProfile,
  viewingProfile,
  partnerProfile,
  onClose,
  onSaved,
}: JournalModalProps) {
  const isOwn = currentUserId === viewingUserId;
  const displayProfile = viewingProfile ?? currentProfile;
  const { showToast } = useToast();

  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingEntry, setExistingEntry] = useState<JournalEntry | null>(null);
  const [partnerEntry, setPartnerEntry] = useState<JournalEntry | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load entries
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const loadEntries = async () => {
      try {
        const entry = await getEntryByDate(viewingUserId, date);
        if (!cancelled) {
          setExistingEntry(entry);
          setContent(entry?.content ?? '');
        }

        // Load partner entry when viewing own journal
        if (isOwn && partnerProfile) {
          const pEntry = await getEntryByDate(partnerProfile.id, date);
          if (!cancelled) setPartnerEntry(pEntry);
        }
      } catch (err) {
        console.error('Failed to load entries:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadEntries();
    return () => { cancelled = true; };
  }, [viewingUserId, date, isOwn, partnerProfile]);

  // Focus textarea
  useEffect(() => {
    if (isOwn && !isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOwn, isLoading]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      await saveEntry(currentUserId, date, content);
      showToast('Entry saved!', 'success');
      onSaved();
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Failed to save entry.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteEntry(currentUserId, date);
      setContent('');
      setExistingEntry(null);
      showToast('Entry deleted.', 'info');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('Failed to delete entry.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const isViewingPartner = !isOwn;
  const colorClass = isViewingPartner ? 'text-secondary' : 'text-primary';

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-overlay/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-card shadow-elevated z-50 flex flex-col animate-slide-right">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-xl">{displayProfile.avatar}</span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {isOwn ? 'My Journal' : `${displayProfile.display_name}'s Journal`}
                {isViewingPartner && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(Read only)</span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">{formatDisplayDate(date)}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : isOwn ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <PenLine className={`w-4 h-4 ${colorClass}`} />
                <span className="text-sm font-medium text-foreground">Write your thoughts</span>
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="input-field min-h-[300px] resize-none leading-relaxed font-serif text-base"
                placeholder="What happened today? How are you feeling?"
              />
              <p className="text-xs text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 rounded-sm bg-surface text-foreground font-mono text-xs">Ctrl+Enter</kbd> to save
              </p>

              {/* Partner's entry preview */}
              {partnerEntry && partnerEntry.content.trim() && partnerProfile && (
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-secondary" />
                    <span className="text-sm font-medium text-foreground">
                      {partnerProfile.avatar} {partnerProfile.display_name}'s entry
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary-light/50 border border-secondary/20">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-serif">
                      {partnerEntry.content}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className={`w-4 h-4 ${colorClass}`} />
                <span className="text-sm font-medium text-foreground">
                  {displayProfile.display_name}'s entry
                </span>
              </div>
              {existingEntry && existingEntry.content.trim() ? (
                <div className="p-5 rounded-xl bg-secondary-light/50 border border-secondary/20">
                  <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap font-serif">
                    {existingEntry.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    Last updated: {new Date(existingEntry.updated_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <BookOpen className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No entry for this date</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions (only for own entries) */}
        {isOwn && !isLoading && (
          <div className="flex items-center justify-between p-5 border-t border-border">
            {existingEntry ? (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn-ghost text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || !content.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Entry
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
