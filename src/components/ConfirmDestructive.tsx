import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ConfirmDestructiveProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText: string;
  confirmPlaceholder?: string;
  isLoading?: boolean;
  destructiveLabel?: string;
}

export default function ConfirmDestructive({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  confirmPlaceholder,
  isLoading,
  destructiveLabel = 'Confirm',
}: ConfirmDestructiveProps) {
  const [value, setValue] = useState('');

  const matches = value.trim().toLowerCase() === confirmText.trim().toLowerCase();

  const handleConfirm = async () => {
    if (!matches) return;
    await onConfirm();
    setValue('');
  };

  const handleClose = () => {
    setValue('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-3">
          <Label className="text-sm">
            Type <span className="font-mono font-semibold text-foreground">{confirmText}</span> to confirm:
          </Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={confirmPlaceholder ?? confirmText}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!matches || isLoading}
            >
              {isLoading ? 'Processing…' : destructiveLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
