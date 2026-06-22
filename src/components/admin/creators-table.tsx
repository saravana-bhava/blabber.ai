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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  ArrowUpDown, 
  Crown, 
  MessageSquare, 
  Activity, 
  DollarSign,
  RefreshCw,
  Zap,
  ZapOff,
  Sparkles
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
  AdminStatusPill,
  adminTdClass,
} from '@/components/admin/admin-ui';

interface CreatorData {
  id: string;
  profile_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  can_monetize: boolean;
  can_img_gen: boolean;
  subscription_tier_enabled: boolean;
  created_at: string;
  is_demo: boolean;
  totalEarnings: number;
  totalTransactions: number;
  subscriptionCount: number;
  isActive: boolean;
  grossRevenue: number;
  creatorEarnings: number;
  platformEarnings: number;
}

interface CreatorsTableProps {
  creators: CreatorData[];
  onRefresh: () => void;
  onToggleDemo: (creatorId: string, isDemo: boolean) => void;
  onToggleImageGen: (creatorId: string, canImgGen: boolean) => void;
  isLoading?: boolean;
}

export function CreatorsTable({ creators, onRefresh, onToggleDemo, onToggleImageGen, isLoading = false }: CreatorsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof CreatorData>('totalEarnings');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleSort = (field: keyof CreatorData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredCreators = creators.filter(creator =>
    creator.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    creator.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedCreators = [...filteredCreators].sort((a, b) => {
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
    
    return 0;
  });

  return (
    <div className="space-y-4">
      <AdminToolbar>
        <AdminSectionTitle
          title="Creator roster"
          description={`${filteredCreators.length} of ${creators.length} creators`}
        />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <AdminSearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search creators…"
            className="sm:min-w-[240px]"
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
              <AdminTh className="w-28">Creator</AdminTh>
              <AdminTh className="w-12">
                <AdminSortBtn onClick={() => handleSort('subscriptionCount')}>
                  Subs <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh className="w-12">
                <AdminSortBtn onClick={() => handleSort('totalTransactions')}>
                  TX <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh className="w-16">
                <AdminSortBtn onClick={() => handleSort('grossRevenue')}>
                  Gross <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh className="w-16">
                <AdminSortBtn onClick={() => handleSort('creatorEarnings')}>
                  Creator <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh className="w-16">
                <AdminSortBtn onClick={() => handleSort('platformEarnings')}>
                  Platform <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh className="w-12">
                <AdminSortBtn onClick={() => handleSort('created_at')}>
                  Joined <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh className="w-16">
                <AdminSortBtn onClick={() => handleSort('can_img_gen')}>
                  <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Img</span>
                  <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
              <AdminTh className="w-16">
                <AdminSortBtn onClick={() => handleSort('is_demo')}>
                  Demo <ArrowUpDown className="h-3 w-3" />
                </AdminSortBtn>
              </AdminTh>
            </AdminTableHeaderRow>
          </TableHeader>
          <TableBody>
            {sortedCreators.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <Crown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Creators Found</h3>
                  <p className="text-muted-foreground">
                    {creators.length === 0 
                      ? "There are no creators in the database yet." 
                      : "No creators match your search criteria."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedCreators.map((creator) => (
                <TableRow key={creator.id} className="admin-row border-b border-border">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={creator.avatar_url || ''} />
                        <AvatarFallback className="h-6 w-6">
                          {creator.full_name?.charAt(0) || creator.username?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-xs">{creator.full_name}</div>
                        <div className="text-xs text-muted-foreground">@{creator.username}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">{creator.subscriptionCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">{creator.totalTransactions}</span>
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <div className="text-sm font-semibold tabular-nums text-[var(--brand-gold)]">
                      {formatCurrency(creator.grossRevenue)}
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <div className="text-sm font-semibold tabular-nums text-[var(--brand-gold)]">
                      {formatCurrency(creator.creatorEarnings)}
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <div className="text-sm font-semibold tabular-nums text-[var(--brand-gold)]">
                      {formatCurrency(creator.platformEarnings)}
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(creator.created_at)}
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <Switch
                      checked={creator.can_img_gen}
                      onCheckedChange={(checked) => onToggleImageGen(creator.id, checked)}
                      aria-label={`Image generation for ${creator.username}`}
                    />
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <div className="flex items-center gap-2">
                      {creator.is_demo && (
                        <AdminStatusPill variant="gold">
                          <Zap className="h-3 w-3" />
                          Demo
                        </AdminStatusPill>
                      )}
                      {creator.is_demo ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 rounded-full hover:bg-secondary"
                              title="Disable demo mode"
                            >
                              <ZapOff className="h-3.5 w-3.5 text-[var(--brand-live)]" />
                            </Button>
                          </AlertDialogTrigger>
                          <AdminAlertPanel
                            title="Disable demo mode"
                            description={`Remove creator record for ${creator.full_name} (@${creator.username})? They will no longer create content or receive payments.`}
                            footer={
                              <>
                                <AdminAlertCancel>Cancel</AdminAlertCancel>
                                <AdminAlertConfirm
                                  destructive
                                  onClick={() => onToggleDemo(creator.id, creator.is_demo)}
                                >
                                  Remove creator record
                                </AdminAlertConfirm>
                              </>
                            }
                          />
                        </AlertDialog>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleDemo(creator.id, creator.is_demo)}
                          className="h-6 w-6 p-0 hover:bg-muted"
                          title="Enable demo mode"
                        >
                          <Zap className="h-3 w-3 text-gray-400 hover:text-orange-600" />
                        </Button>
                      )}
                    </div>
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