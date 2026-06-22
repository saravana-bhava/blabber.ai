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
import { AlertDialog, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { 
  ArrowUpDown, 
  Users, 
  Shield, 
  Ban, 
  CreditCard,
  Search,
  RefreshCw,
  Calendar,
  Key,
  Zap,
  MoreVertical,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import {
  AdminSectionTitle,
  AdminSearchBar,
  AdminGhostButton,
  AdminTableShell,
  AdminToolbar,
  AdminTableHeaderRow,
  AdminTh,
  AdminSortBtn,
  AdminAlertPanel,
  AdminAlertCancel,
  AdminAlertConfirm,
  AdminDialogPanel,
  AdminGradButton,
  AdminStatusPill,
  adminTdClass,
  adminInputClass,
  brandCancelBtn,
} from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';

interface UserData {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  email: string;
  isAdmin: boolean;
  isBanned: boolean;
  created_at: string;
  lastSeen: string;
  credits: number;
}

interface UsersTableProps {
  users: UserData[];
  onRefresh: () => void;
  onToggleBan: (userId: string, isBanned: boolean) => void;
  onToggleAdmin: (userId: string, isAdmin: boolean) => void;
  onUpdateCredits: (userId: string, credits: number) => void;
  onResetPassword: (userId: string, newPassword: string) => void;
  onCreateDemoCreator: (userId: string) => void;
  onGrantFullVerifiedCreator: (userId: string) => void;
  onGrantFullVerifiedAgency: (userId: string, agencyName: string) => void;
  isLoading?: boolean;
}

export function UsersTable({ 
  users, 
  onRefresh, 
  onToggleBan, 
  onToggleAdmin, 
  onUpdateCredits, 
  onResetPassword, 
  onCreateDemoCreator,
  onGrantFullVerifiedCreator,
  onGrantFullVerifiedAgency,
  isLoading = false 
}: UsersTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof UserData>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editingCredits, setEditingCredits] = useState<string | null>(null);
  const [newCredits, setNewCredits] = useState('');
  const [passwordResetUser, setPasswordResetUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [grantAgencyUser, setGrantAgencyUser] = useState<string | null>(null);
  const [grantAgencyName, setGrantAgencyName] = useState('');

  const handleGrantAgency = (userId: string) => {
    const trimmed = grantAgencyName.trim();
    if (!trimmed) {
      alert('Agency name is required');
      return;
    }
    onGrantFullVerifiedAgency(userId, trimmed);
    setGrantAgencyUser(null);
    setGrantAgencyName('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handlePasswordReset = (userId: string) => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }
    onResetPassword(userId, newPassword);
    setPasswordResetUser(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSort = (field: keyof UserData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      return sortDirection === 'asc' ? (aValue === bValue ? 0 : aValue ? 1 : -1) : (aValue === bValue ? 0 : aValue ? -1 : 1);
    }
    
    return 0;
  });

  return (
    <div className="space-y-4">
      <AdminToolbar>
        <AdminSectionTitle
          title="Users"
          description={`${filteredUsers.length} of ${users.length} users`}
        />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <AdminSearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name, @handle, or email…"
            className="sm:min-w-[280px]"
          />
          <AdminGhostButton onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </AdminGhostButton>
        </div>
      </AdminToolbar>

      <AdminTableShell>
        <Table>
          <TableHeader>
            <AdminTableHeaderRow>
              <AdminTh>User</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>
                <AdminSortBtn onClick={() => handleSort('credits')}>
                  Credits <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh>
                <AdminSortBtn onClick={() => handleSort('created_at')}>
                  Joined <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh>Actions</AdminTh>
            </AdminTableHeaderRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Users Found</h3>
                  <p className="text-muted-foreground">
                    {users.length === 0 
                      ? "There are no users in the database yet." 
                      : "No users match your search criteria."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => (
                <TableRow key={user.id} className="admin-row border-b border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback className="h-10 w-10">
                          {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground">@{user.username}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.isAdmin && (
                        <AdminStatusPill variant="staff">
                          <Shield className="h-3 w-3" />
                          Admin
                        </AdminStatusPill>
                      )}
                      {user.isBanned && (
                        <AdminStatusPill variant="live">
                          <Ban className="h-3 w-3" />
                          Banned
                        </AdminStatusPill>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingCredits === user.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={newCredits}
                          onChange={(e) => setNewCredits(e.target.value)}
                          className={cn('w-20 h-8 text-sm', adminInputClass)}
                        />
                        <AdminGradButton
                          size="sm"
                          onClick={() => {
                            onUpdateCredits(user.id, parseInt(newCredits) || 0);
                          }}
                          className="h-8 px-2 text-xs"
                        >
                          Save
                        </AdminGradButton>
                        <AdminGhostButton
                          size="sm"
                          onClick={() => {
                            setEditingCredits(null);
                            setNewCredits('');
                          }}
                          className="h-8 px-2 text-xs"
                        >
                          Cancel
                        </AdminGhostButton>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{user.credits}</span>
                        </div>
                        <AdminGhostButton
                          size="sm"
                          onClick={() => {
                            setEditingCredits(user.id);
                            setNewCredits(user.credits.toString());
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          Edit
                        </AdminGhostButton>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {formatDate(user.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              {user.isBanned ? <Users className="h-4 w-4 mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                              {user.isBanned ? 'Unban User' : 'Ban User'}
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AdminAlertPanel
                            title={user.isBanned ? 'Unban user' : 'Ban user'}
                            description={`Are you sure you want to ${user.isBanned ? 'unban' : 'ban'} ${user.full_name} (@${user.username})?`}
                            footer={
                              <>
                                <AdminAlertCancel>Cancel</AdminAlertCancel>
                                <AdminAlertConfirm
                                  destructive={!user.isBanned}
                                  onClick={() => onToggleBan(user.id, user.isBanned)}
                                >
                                  {user.isBanned ? 'Unban' : 'Ban'}
                                </AdminAlertConfirm>
                              </>
                            }
                          />
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              {user.isAdmin ? <Users className="h-4 w-4 mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                              {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AdminAlertPanel
                            title={user.isAdmin ? 'Remove admin status' : 'Make admin'}
                            description={`Are you sure you want to ${user.isAdmin ? 'remove admin status from' : 'make admin'} ${user.full_name} (@${user.username})?`}
                            footer={
                              <>
                                <AdminAlertCancel>Cancel</AdminAlertCancel>
                                <AdminAlertConfirm onClick={() => onToggleAdmin(user.id, user.isAdmin)}>
                                  {user.isAdmin ? 'Remove admin' : 'Make admin'}
                                </AdminAlertConfirm>
                              </>
                            }
                          />
                        </AlertDialog>

                        <DropdownMenuSeparator />

                        <Dialog open={passwordResetUser === user.id} onOpenChange={(open) => {
                          if (!open) {
                            setPasswordResetUser(null);
                            setNewPassword('');
                            setConfirmPassword('');
                          }
                        }}>
                          <DialogTrigger asChild>
                            <DropdownMenuItem 
                              onSelect={(e) => e.preventDefault()}
                              onClick={() => setPasswordResetUser(user.id)}
                            >
                              <Key className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                          </DialogTrigger>
                          <AdminDialogPanel
                            icon={Key}
                            title={`Reset password — ${user.full_name}`}
                            footer={
                              <>
                                <Button
                                  variant="outline"
                                  className={brandCancelBtn}
                                  onClick={() => {
                                    setPasswordResetUser(null);
                                    setNewPassword('');
                                    setConfirmPassword('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <AdminGradButton
                                  onClick={() => handlePasswordReset(user.id)}
                                  disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
                                >
                                  Reset password
                                </AdminGradButton>
                              </>
                            }
                          >
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="new-password">New password</Label>
                                <Input
                                  id="new-password"
                                  type="password"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder="Enter new password"
                                  className={adminInputClass}
                                  minLength={6}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm password</Label>
                                <Input
                                  id="confirm-password"
                                  type="password"
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  placeholder="Confirm new password"
                                  className={adminInputClass}
                                  minLength={6}
                                />
                              </div>
                            </div>
                          </AdminDialogPanel>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <ShieldCheck className="h-4 w-4 mr-2 text-emerald-600" />
                              Grant verified creator (bypass KYC)
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AdminAlertPanel
                            title="Grant verified creator"
                            description={`Mark ${user.full_name} (@${user.username}) as fully verified with monetization enabled, without Veriff. Demo mode will be turned off if it was on.`}
                            footer={
                              <>
                                <AdminAlertCancel>Cancel</AdminAlertCancel>
                                <AdminAlertConfirm onClick={() => onGrantFullVerifiedCreator(user.id)}>
                                  Grant verified creator
                                </AdminAlertConfirm>
                              </>
                            }
                          />
                        </AlertDialog>

                        <Dialog
                          open={grantAgencyUser === user.id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setGrantAgencyUser(null);
                              setGrantAgencyName('');
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              onClick={() => {
                                setGrantAgencyUser(user.id);
                                setGrantAgencyName(
                                  user.full_name ? `${user.full_name}'s Agency` : 'My Agency'
                                );
                              }}
                            >
                              <Building2 className="h-4 w-4 mr-2 text-emerald-600" />
                              Grant verified agency (bypass KYC)
                            </DropdownMenuItem>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Grant verified agency</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                              <p className="text-sm text-muted-foreground">
                                Mark {user.full_name} (@{user.username}) as a fully verified agency
                                without Veriff. Use only for trusted accounts or internal testing.
                              </p>
                              <div className="space-y-2">
                                <Label htmlFor="agency-name">Agency name</Label>
                                <Input
                                  id="agency-name"
                                  value={grantAgencyName}
                                  onChange={(e) => setGrantAgencyName(e.target.value)}
                                  placeholder="e.g. Sunset Talent"
                                  maxLength={80}
                                />
                              </div>
                              <div className="flex justify-end gap-2 pt-4">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setGrantAgencyUser(null);
                                    setGrantAgencyName('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => handleGrantAgency(user.id)}
                                  disabled={!grantAgencyName.trim()}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  Grant verified agency
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Zap className="h-4 w-4 mr-2 text-yellow-600" />
                              Create Demo Creator
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AdminAlertPanel
                            title="Create demo creator"
                            description={`Create a demo creator account for ${user.full_name} (@${user.username})? They can bypass payments for testing.`}
                            footer={
                              <>
                                <AdminAlertCancel>Cancel</AdminAlertCancel>
                                <AdminAlertConfirm onClick={() => onCreateDemoCreator(user.id)}>
                                  Create demo creator
                                </AdminAlertConfirm>
                              </>
                            }
                          />
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableShell>
    </div>
  );
}
