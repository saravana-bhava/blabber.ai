'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import {
  User as UserIcon,
  DollarSign,
  ShoppingCart,
  HelpCircle,
  CreditCard,
  LogOut,
  Loader2,
  Sun,
  Moon,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { usePulseUI } from '@/lib/contexts/pulse-ui-context';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type AccountMenuProfile = {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type AccountMenuProps = {
  profile: AccountMenuProfile;
  isCreator: boolean;
  isInDrawer?: boolean;
  onLinkClick?: () => void;
  trigger: React.ReactNode;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground/80">
      {children}
    </p>
  );
}

function MenuRow({
  icon: Icon,
  label,
  href,
  external,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const className =
    'flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left text-foreground transition-colors hover:bg-muted/60';

  const content = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.9} />
      <span className="flex-1 text-[14.5px] font-medium">{label}</span>
    </>
  );

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className={className}
        >
          {content}
        </a>
      );
    }
    return (
      <Link href={href} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function AccountMenuHeader({ profile }: { profile: AccountMenuProfile }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={profile.full_name || 'User Avatar'}
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        ) : (
          (profile.full_name || 'U').charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-foreground">
          {profile.full_name}
        </p>
        <p className="truncate text-[12.5px] text-muted-foreground">@{profile.username}</p>
      </div>
    </div>
  );
}

function AccountMenuPanel({
  profile,
  isCreator,
  onLinkClick,
  onClose,
}: {
  profile: AccountMenuProfile;
  isCreator: boolean;
  onLinkClick?: () => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { setTheme, resolvedTheme } = useTheme();
  const { pulseEnabled, setMode } = usePulseUI();
  const [themeMounted, setThemeMounted] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => setThemeMounted(true), []);

  const isDarkMode = themeMounted && resolvedTheme === 'dark';

  const handleNavigate = () => {
    onLinkClick?.();
    onClose?.();
  };

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setTheme(newTheme);
    toast.success(`Switched to ${newTheme} mode`);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    onClose?.();
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully');
      router.push('/');
    } catch {
      toast.error('Failed to sign out');
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col">
      <AccountMenuHeader profile={profile} />

      <div className="px-2 pb-2">
        <SectionLabel>Account</SectionLabel>
        <MenuRow icon={UserIcon} label="My Account" href="/account" onClick={handleNavigate} />
        <MenuRow
          icon={DollarSign}
          label="Transactions"
          href="/transactions"
          onClick={handleNavigate}
        />
        {isCreator && (
          <MenuRow
            icon={ShoppingCart}
            label="Creator Orders"
            href="/creator-orders"
            onClick={handleNavigate}
          />
        )}

        <SectionLabel>Platform</SectionLabel>
        <div className="flex items-center justify-between gap-3 rounded-[11px] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[14.5px] font-medium text-foreground">Pulse visuals</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Turn off for the classic UI if anything looks off.
            </p>
          </div>
          <Switch
            checked={pulseEnabled}
            onCheckedChange={(v) => setMode(v ? 'pulse' : 'classic')}
            aria-label="Toggle Blabber Pulse motion"
          />
        </div>
        <MenuRow
          icon={HelpCircle}
          label="Help Center"
          href="/help-center"
          onClick={handleNavigate}
        />
        <MenuRow
          icon={CreditCard}
          label="Billing Support"
          href="https://epoch.com"
          external
          onClick={handleNavigate}
        />
      </div>

      <div className="flex gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-full border border-border/70 bg-muted/30 text-[13.5px] font-semibold text-foreground transition-colors hover:bg-muted/60"
        >
          {themeMounted && isDarkMode ? (
            <Sun className="h-[17px] w-[17px]" />
          ) : (
            <Moon className="h-[17px] w-[17px]" />
          )}
          {themeMounted && isDarkMode ? 'Light' : 'Dark'}
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={isSigningOut}
              className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-full border border-border/70 bg-muted/30 text-[13.5px] font-semibold text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningOut ? (
                <Loader2 className="h-[17px] w-[17px] animate-spin" />
              ) : (
                <LogOut className="h-[17px] w-[17px]" />
              )}
              {isSigningOut ? 'Signing out…' : 'Log out'}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out?</AlertDialogTitle>
              <AlertDialogDescription>
                You&apos;ll need to sign in again to access your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSignOut}
                className="text-white"
                style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
              >
                Sign out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function AccountMenuSheet({
  profile,
  isCreator,
  onLinkClick,
  onClose,
}: {
  profile: AccountMenuProfile;
  isCreator: boolean;
  onLinkClick?: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[119] bg-black/55 backdrop-blur-[4px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
        className={cn(
          'fixed inset-x-0 bottom-0 z-[120] max-h-[min(88vh,640px)] overflow-hidden rounded-t-[20px] border-t border-border bg-background shadow-2xl',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-300',
          'pb-[env(safe-area-inset-bottom,0px)]'
        )}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-[34px] w-[34px] place-items-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close account menu"
        >
          <Plus className="h-[18px] w-[18px] rotate-45" />
        </button>
        <div className="max-h-[calc(min(88vh,640px)-2rem)] overflow-y-auto overscroll-contain">
          <AccountMenuPanel
            profile={profile}
            isCreator={isCreator}
            onLinkClick={onLinkClick}
            onClose={onClose}
          />
        </div>
      </div>
    </>,
    document.body
  );
}

export function AccountMenu({
  profile,
  isCreator,
  isInDrawer = false,
  onLinkClick,
  trigger,
}: AccountMenuProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isInDrawer) {
    const openSheet = () => setSheetOpen(true);
    const triggerElement = React.isValidElement(trigger)
      ? React.cloneElement(
          trigger as React.ReactElement<{ onClick?: React.MouseEventHandler }>,
          {
            onClick: (e: React.MouseEvent) => {
              (
                trigger as React.ReactElement<{ onClick?: React.MouseEventHandler }>
              ).props.onClick?.(e);
              if (!e.defaultPrevented) openSheet();
            },
          }
        )
      : trigger;

    return (
      <>
        {triggerElement}
        {sheetOpen && (
          <AccountMenuSheet
            profile={profile}
            isCreator={isCreator}
            onLinkClick={onLinkClick}
            onClose={() => setSheetOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="right"
        sideOffset={8}
        alignOffset={0}
        className="account-menu-dropdown w-[272px] overflow-hidden rounded-2xl border border-border p-0 shadow-lg"
        style={{ zIndex: 1000 }}
      >
        <AccountMenuPanel
          profile={profile}
          isCreator={isCreator}
          onLinkClick={onLinkClick}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
