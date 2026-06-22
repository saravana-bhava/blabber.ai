'use client';

import { useState } from 'react';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { sendAdminPushNotification } from '@/app/actions/adminActions';
import { cn } from '@/lib/utils';
import {
  AdminDialogPanel,
  AdminGhostButton,
  AdminGradButton,
  adminInputClass,
  adminSelectTriggerClass,
  adminTextareaClass,
  brandCancelBtn,
} from '@/components/admin/admin-ui';

interface PushNotificationModalProps {
  trigger?: React.ReactNode;
}

export function PushNotificationModal({ trigger }: PushNotificationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    target: 'all' as 'all' | 'creators',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.body.trim()) {
      toast.error('Please fill in both title and body');
      return;
    }

    setIsSending(true);

    try {
      const result = await sendAdminPushNotification({
        title: formData.title.trim(),
        body: formData.body.trim(),
        target: formData.target,
      });

      if (result.success) {
        toast.success(result.message);
        setFormData({ title: '', body: '', target: 'all' });
        setIsOpen(false);
      } else {
        toast.error(result.error || 'Failed to send notifications');
      }
    } catch (error) {
      console.error('Error sending push notifications:', error);
      toast.error('Failed to send notifications. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <AdminGhostButton>
            <Bell className="h-4 w-4" />
            Send push notifications
          </AdminGhostButton>
        )}
      </DialogTrigger>
      <AdminDialogPanel
        icon={Bell}
        title="Send push notification"
        description="Broadcast to all users or creators only. Creates in-app notifications and sends to registered devices."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className={brandCancelBtn}
              onClick={() => setIsOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <AdminGradButton
              type="submit"
              form="admin-push-form"
              disabled={isSending || !formData.title.trim() || !formData.body.trim()}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send notification
                </>
              )}
            </AdminGradButton>
          </>
        }
      >
        <form id="admin-push-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="target">Target audience</Label>
            <Select value={formData.target} onValueChange={(value) => handleInputChange('target', value)}>
              <SelectTrigger id="target" className={cn('mt-1.5 w-full', adminSelectTriggerClass)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="creators">Creators only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="title">Notification title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter notification title…"
              className={cn('mt-1.5', adminInputClass)}
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="body">Notification message</Label>
            <Textarea
              id="body"
              value={formData.body}
              onChange={(e) => handleInputChange('body', e.target.value)}
              placeholder="Enter notification message…"
              className={cn('mt-1.5', adminTextareaClass)}
              rows={3}
              maxLength={500}
            />
          </div>
        </form>
      </AdminDialogPanel>
    </Dialog>
  );
}
