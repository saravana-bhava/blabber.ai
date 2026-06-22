'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  ArrowUpDown, 
  Bug, 
  Search, 
  RefreshCw,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  AdminSectionTitle,
  AdminSearchBar,
  AdminTableShell,
  AdminToolbar,
  AdminTableHeaderRow,
  AdminTh,
  AdminSortBtn,
  AdminDialogPanel,
  AdminGhostButton,
  AdminGradButton,
  AdminStatusPill,
  adminTdClass,
  adminSelectTriggerClass,
  adminTextareaClass,
  brandCancelBtn,
} from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';

interface BugReportData {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  browser: string | null;
  device: string | null;
  additional_info: string | null;
  status: string;
  admin_notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  user?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
  assigned_user?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

interface BugReportsTableProps {
  bugReports: BugReportData[];
  onRefresh: () => void;
  onUpdateStatus: (id: string, status: string, adminNotes?: string) => void;
  onAssignTo: (id: string, assignedTo: string | null) => void;
  isLoading?: boolean;
}

const severityVariant = (severity: string): 'soft' | 'gold' | 'live' | 'staff' | 'violet' => {
  if (severity === 'critical') return 'live';
  if (severity === 'high') return 'staff';
  if (severity === 'medium') return 'gold';
  return 'soft';
};

const statusVariant = (status: string): 'soft' | 'gold' | 'live' | 'staff' | 'violet' => {
  if (status === 'open') return 'violet';
  if (status === 'in_progress') return 'gold';
  if (status === 'resolved') return 'gold';
  if (status === 'duplicate') return 'staff';
  return 'soft';
};

const categoryLabels = {
  ui_ux: 'UI/UX',
  functionality: 'Functionality',
  performance: 'Performance',
  payment: 'Payment',
  media: 'Media',
  notifications: 'Notifications',
  mobile: 'Mobile',
  other: 'Other'
};

export function BugReportsTable({ 
  bugReports, 
  onRefresh, 
  onUpdateStatus,
  onAssignTo,
  isLoading = false 
}: BugReportsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof BugReportData>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedBug, setSelectedBug] = useState<BugReportData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSort = (field: keyof BugReportData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredBugReports = bugReports.filter(bug =>
    bug.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bug.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bug.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bug.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bug.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedBugReports = [...filteredBugReports].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return 0;
  });

  const handleViewDetails = (bug: BugReportData) => {
    setSelectedBug(bug);
    setAdminNotes(bug.admin_notes || '');
    setNewStatus(bug.status);
    setIsDetailOpen(true);
  };

  const handleUpdateBug = async () => {
    if (!selectedBug) return;
    
    setIsUpdating(true);
    try {
      await onUpdateStatus(selectedBug.id, newStatus, adminNotes);
      setIsDetailOpen(false);
      setSelectedBug(null);
      toast.success('Bug report updated successfully');
    } catch (error) {
      toast.error('Failed to update bug report');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertTriangle className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4" />;
      case 'closed':
        return <XCircle className="h-4 w-4" />;
      case 'duplicate':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Bug className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <AdminToolbar>
        <AdminSectionTitle
          title="Bug reports"
          description={`${filteredBugReports.length} of ${bugReports.length} reports`}
        />
        <AdminSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search bug reports…"
          className="sm:min-w-[280px]"
        />
      </AdminToolbar>

      <AdminTableShell>
        <Table>
          <TableHeader>
            <AdminTableHeaderRow>
              <AdminTh>Bug report</AdminTh>
              <AdminTh>Reporter</AdminTh>
              <AdminTh>
                <AdminSortBtn onClick={() => handleSort('category')}>
                  Category <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh>
                <AdminSortBtn onClick={() => handleSort('severity')}>
                  Severity <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh>
                <AdminSortBtn onClick={() => handleSort('status')}>
                  Status <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh>
                <AdminSortBtn onClick={() => handleSort('created_at')}>
                  Reported <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh>Actions</AdminTh>
            </AdminTableHeaderRow>
          </TableHeader>
          <TableBody>
            {sortedBugReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Bug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Bug Reports Found</h3>
                  <p className="text-muted-foreground">
                    {bugReports.length === 0 
                      ? "There are no bug reports in the database yet." 
                      : "No bug reports match your search criteria."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedBugReports.map((bug) => (
                <TableRow key={bug.id} className="admin-row border-b border-border">
                  <TableCell>
                    <div className="max-w-xs">
                      <div className="font-medium truncate">{bug.title}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {bug.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={bug.user?.avatar_url || ''} />
                        <AvatarFallback>
                          {bug.user?.full_name?.charAt(0) || bug.user?.username?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">@{bug.user?.username}</div>
                        <div className="text-xs text-muted-foreground">{bug.user?.full_name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <AdminStatusPill variant="soft">
                      {categoryLabels[bug.category as keyof typeof categoryLabels] || bug.category}
                    </AdminStatusPill>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <AdminStatusPill variant={severityVariant(bug.severity)}>
                      {bug.severity}
                    </AdminStatusPill>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <AdminStatusPill variant={statusVariant(bug.status)}>
                      <span className="inline-flex items-center gap-1">
                        {getStatusIcon(bug.status)}
                        {bug.status.replace('_', ' ')}
                      </span>
                    </AdminStatusPill>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <div className="text-sm">{formatDate(bug.created_at)}</div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <AdminGhostButton size="sm" className="h-8 px-3 text-xs" onClick={() => handleViewDetails(bug)}>
                      View details
                    </AdminGhostButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableShell>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        {selectedBug && (
          <AdminDialogPanel
            icon={Bug}
            title={selectedBug.title}
            description="Review and update bug report status"
            size="wide"
            footer={
              <>
                <Button variant="outline" className={brandCancelBtn} onClick={() => setIsDetailOpen(false)}>
                  Cancel
                </Button>
                <AdminGradButton onClick={handleUpdateBug} disabled={isUpdating}>
                  {isUpdating ? 'Updating…' : 'Update report'}
                </AdminGradButton>
              </>
            }
          >
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold">Category</Label>
                  <div className="mt-1.5">
                    <AdminStatusPill variant="soft">
                      {categoryLabels[selectedBug.category as keyof typeof categoryLabels] || selectedBug.category}
                    </AdminStatusPill>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Severity</Label>
                  <div className="mt-1.5">
                    <AdminStatusPill variant={severityVariant(selectedBug.severity)}>{selectedBug.severity}</AdminStatusPill>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Status</Label>
                  <div className="mt-1.5">
                    <AdminStatusPill variant={statusVariant(selectedBug.status)}>
                      {selectedBug.status.replace('_', ' ')}
                    </AdminStatusPill>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Reported</Label>
                  <p className="text-sm mt-1.5 text-muted-foreground">{formatDate(selectedBug.created_at)}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Description</Label>
                <p className="text-sm mt-1.5 whitespace-pre-wrap text-muted-foreground">{selectedBug.description}</p>
              </div>

              {selectedBug.steps_to_reproduce && (
                <div>
                  <Label className="text-sm font-semibold">Steps to reproduce</Label>
                  <p className="text-sm mt-1.5 whitespace-pre-wrap text-muted-foreground">{selectedBug.steps_to_reproduce}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedBug.expected_behavior && (
                  <div>
                    <Label className="text-sm font-semibold">Expected behavior</Label>
                    <p className="text-sm mt-1.5 text-muted-foreground">{selectedBug.expected_behavior}</p>
                  </div>
                )}
                {selectedBug.actual_behavior && (
                  <div>
                    <Label className="text-sm font-semibold">Actual behavior</Label>
                    <p className="text-sm mt-1.5 text-muted-foreground">{selectedBug.actual_behavior}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedBug.browser && (
                  <div>
                    <Label className="text-sm font-semibold">Browser</Label>
                    <p className="text-sm mt-1.5 text-muted-foreground">{selectedBug.browser}</p>
                  </div>
                )}
                {selectedBug.device && (
                  <div>
                    <Label className="text-sm font-semibold">Device</Label>
                    <p className="text-sm mt-1.5 text-muted-foreground">{selectedBug.device}</p>
                  </div>
                )}
              </div>

              {selectedBug.additional_info && (
                <div>
                  <Label className="text-sm font-semibold">Additional information</Label>
                  <p className="text-sm mt-1.5 whitespace-pre-wrap text-muted-foreground">{selectedBug.additional_info}</p>
                </div>
              )}

              <div className="space-y-4 border-t border-border pt-4">
                <div>
                  <Label htmlFor="status" className="text-sm font-semibold">Update status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger id="status" className={cn('mt-1.5 w-full', adminSelectTriggerClass)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="duplicate">Duplicate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="adminNotes" className="text-sm font-semibold">Admin notes</Label>
                  <Textarea
                    id="adminNotes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes about this bug report…"
                    className={cn('mt-1.5', adminTextareaClass)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </AdminDialogPanel>
        )}
      </Dialog>
    </div>
  );
} 