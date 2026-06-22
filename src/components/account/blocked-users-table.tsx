'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Calendar,
  RefreshCw,
  UserX,
} from 'lucide-react';
import {
  AdminGhostButton,
  AdminAlertPanel,
  AdminAlertCancel,
  AdminAlertConfirm,
  AdminTableHeaderRow,
  AdminTh,
  adminTdClass,
} from '@/components/admin/admin-ui';

interface BlockedUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  blocked_at: string;
}

interface BlockedUsersTableProps {
  currentUserId: string;
}

export function BlockedUsersTable({ currentUserId }: BlockedUsersTableProps) {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockLoading, setUnblockLoading] = useState<string | null>(null);

  const supabase = createClient();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const fetchBlockedUsers = async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          blockee_profile_id,
          created_at,
          blockee:profiles!blocked_users_blockee_profile_id_fkey(
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('blocker_profile_id', currentUserId);

      if (error) {
        console.error('Error fetching blocked users:', error);
        return;
      }

      const users = data?.map((item: any) => ({
        id: item.blockee.id,
        username: item.blockee.username,
        full_name: item.blockee.full_name,
        avatar_url: item.blockee.avatar_url,
        blocked_at: item.created_at
      })) || [];

      setBlockedUsers(users);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    if (!currentUserId) return;

    setUnblockLoading(userId);
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_profile_id', currentUserId)
        .eq('blockee_profile_id', userId);

      if (error) {
        console.error('Error unblocking user:', error);
        return;
      }

      setBlockedUsers(prev => prev.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error unblocking user:', error);
    } finally {
      setUnblockLoading(null);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [currentUserId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div
          className="h-7 w-7 rounded-full border-2 border-[var(--brand-pink)] border-t-transparent animate-spin"
          role="status"
          aria-label="Loading blocked users"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {blockedUsers.length} blocked user{blockedUsers.length !== 1 ? 's' : ''}
        </span>
        <AdminGhostButton onClick={fetchBlockedUsers} disabled={loading} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </AdminGhostButton>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <AdminTableHeaderRow>
              <AdminTh>User</AdminTh>
              <AdminTh>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Date blocked
                </span>
              </AdminTh>
              <AdminTh>Actions</AdminTh>
            </AdminTableHeaderRow>
          </TableHeader>
          <TableBody>
            {blockedUsers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="text-center py-10">
                  <UserX className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <h3 className="text-base font-semibold mb-1">No blocked users</h3>
                  <p className="text-sm text-muted-foreground">
                    You haven&apos;t blocked any users yet.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              blockedUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-secondary/40">
                  <TableCell className={adminTdClass}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback>
                          {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-sm">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground">@{user.username}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {formatDate(user.blocked_at)}
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <AdminGhostButton size="sm">
                          Unblock
                        </AdminGhostButton>
                      </AlertDialogTrigger>
                      <AdminAlertPanel
                        title="Unblock user"
                        description={`Are you sure you want to unblock ${user.full_name} (@${user.username})? You will be able to see their content and interact with them again.`}
                        footer={
                          <>
                            <AdminAlertCancel>Cancel</AdminAlertCancel>
                            <AdminAlertConfirm
                              onClick={() => handleUnblockUser(user.id)}
                              disabled={unblockLoading === user.id}
                            >
                              {unblockLoading === user.id ? 'Unblocking…' : 'Unblock'}
                            </AdminAlertConfirm>
                          </>
                        }
                      />
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
