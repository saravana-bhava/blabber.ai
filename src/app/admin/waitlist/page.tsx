'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Archive,
  RefreshCw,
  Search,
  ExternalLink,
  Mail,
  Loader2,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type WaitlistStatus = 'pending' | 'approved' | 'archived';

interface WaitlistEntry {
  id: string;
  email: string;
  instagram_handle: string | null;
  other_socials: string | null;
  status: WaitlistStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  approved_email_sent_at: string | null;
  notes: string | null;
}

const TABS: { value: WaitlistStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'archived', label: 'Archived' },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

function statusBadgeClasses(status: WaitlistStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'archived':
      return 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/30';
    case 'pending':
    default:
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
  }
}

function AdminWaitlistPageInner() {
  const supabase = createClient();
  const router = useRouter();
  const { profile, isLoading: isUserLoading } = useUser();

  const [tab, setTab] = useState<WaitlistStatus>('pending');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isApproving, setIsApproving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);

  useEffect(() => {
    if (!isUserLoading && profile && !profile.isAdmin) {
      router.push('/home');
    }
  }, [profile, isUserLoading, router]);

  const loadEntries = useCallback(
    async (status: WaitlistStatus) => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('beta_signup_emails')
          .select(
            'id, email, instagram_handle, other_socials, status, created_at, reviewed_at, reviewed_by, approved_email_sent_at, notes'
          )
          .eq('status', status)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('beta_signup_emails select:', error);
          toast.error('Failed to load waitlist');
          setEntries([]);
          return;
        }

        setEntries((data ?? []) as WaitlistEntry[]);
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (profile?.isAdmin) {
      setSelectedIds(new Set());
      loadEntries(tab);
    }
  }, [tab, profile?.isAdmin, loadEntries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      return (
        e.email.toLowerCase().includes(q) ||
        (e.instagram_handle?.toLowerCase().includes(q) ?? false) ||
        (e.other_socials?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, search]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id));
  const someVisibleSelected = filtered.some((e) => selectedIds.has(e.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((e) => next.delete(e.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((e) => next.add(e.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;

  const handleArchive = async () => {
    if (selectedCount === 0) return;
    setIsArchiving(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch('/api/admin/waitlist/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Failed to archive');
        return;
      }
      toast.success(`Archived ${data?.archived ?? ids.length} entr${(data?.archived ?? ids.length) === 1 ? 'y' : 'ies'}`);
      setSelectedIds(new Set());
      await loadEntries(tab);
    } catch (e) {
      console.error('archive:', e);
      toast.error('Failed to archive');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleApprove = async () => {
    if (selectedCount === 0) return;
    setIsApproving(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch('/api/admin/waitlist/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Failed to approve');
        return;
      }
      const approved = data?.approved ?? 0;
      const emailed = data?.emailed ?? 0;
      if (approved > 0 && emailed === approved) {
        toast.success(`Approved ${approved} and sent acceptance email${approved === 1 ? '' : 's'}`);
      } else if (approved > 0) {
        toast.warning(
          `Approved ${approved} but only ${emailed} email${emailed === 1 ? '' : 's'} sent. Check Resend logs.`
        );
      } else {
        toast.error('No entries were approved');
      }
      setSelectedIds(new Set());
      setConfirmApproveOpen(false);
      await loadEntries(tab);
    } catch (e) {
      console.error('approve:', e);
      toast.error('Failed to approve');
    } finally {
      setIsApproving(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile?.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Beta waitlist review
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Approve or archive waitlist signups. Approving sends an
              acceptance email with the Discord invite and a sign-in link.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadEntries(tab)}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as WaitlistStatus)}>
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search email or socials…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <div className="text-sm text-muted-foreground">
            {selectedCount > 0 ? (
              <>
                <span className="font-medium text-foreground">
                  {selectedCount}
                </span>{' '}
                selected
              </>
            ) : (
              <>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedCount === 0 || isArchiving || isApproving}
              onClick={handleArchive}
              className="gap-2"
            >
              {isArchiving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              Archive
            </Button>
            {tab === 'pending' && (
              <Button
                type="button"
                size="sm"
                disabled={selectedCount === 0 || isArchiving || isApproving}
                onClick={() => setConfirmApproveOpen(true)}
                className="gap-2 bg-pink-500 text-white hover:bg-pink-600"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Approve & email
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all"
                    aria-checked={
                      allVisibleSelected
                        ? 'true'
                        : someVisibleSelected
                          ? 'mixed'
                          : 'false'
                    }
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Instagram</TableHead>
                <TableHead>Other socials</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Email sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    {search.trim().length > 0
                      ? 'No matches for your search.'
                      : `No ${tab} entries yet.`}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((entry) => {
                  const checked = selectedIds.has(entry.id);
                  return (
                    <TableRow
                      key={entry.id}
                      data-state={checked ? 'selected' : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${entry.email}`}
                          checked={checked}
                          onCheckedChange={() => toggleSelect(entry.id)}
                        />
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <a
                            href={`mailto:${entry.email}`}
                            className="truncate font-medium hover:underline"
                          >
                            {entry.email}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.instagram_handle ? (
                          <a
                            href={`https://instagram.com/${entry.instagram_handle.replace(/^@+/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm hover:underline"
                          >
                            @{entry.instagram_handle.replace(/^@+/, '')}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {entry.other_socials ? (
                          <span
                            className="line-clamp-2 text-sm text-foreground/80"
                            title={entry.other_socials}
                          >
                            {entry.other_socials}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize ${statusBadgeClasses(entry.status)}`}
                        >
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.created_at)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(entry.approved_email_sent_at)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={confirmApproveOpen} onOpenChange={setConfirmApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approve {selectedCount} waitlist entr{selectedCount === 1 ? 'y' : 'ies'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Each selected user will be marked as <strong>approved</strong> and
              receive a Resend email with the Discord invite and a sign-in
              link. This action cannot be undone, but you can re-archive an
              entry afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isApproving}
              onClick={(e) => {
                e.preventDefault();
                handleApprove();
              }}
              className="bg-pink-500 text-white hover:bg-pink-600"
            >
              {isApproving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </span>
              ) : (
                'Approve & send emails'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminWaitlistPage() {
  return (
    <RequireAuth>
      <AdminWaitlistPageInner />
    </RequireAuth>
  );
}
