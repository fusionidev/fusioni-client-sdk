import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  currentLanguage?: 'en' | 'el';
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  currentLanguage = 'en',
  variant = 'danger'
}) => {
  const { t } = useTranslation(currentLanguage);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fusioni-dialog-backdrop"
        onClick={onCancel}
      />
      <div className="fusioni-dialog-container">
        <div className="fusioni-dialog">
          <div className="fusioni-dialog-header">
            <h3 className="fusioni-dialog-title">{title}</h3>
          </div>
          <div className="fusioni-dialog-body">
            <p className="fusioni-dialog-message">{message}</p>
          </div>
          <div className="fusioni-dialog-footer">
            <button
              onClick={onCancel}
              className="fusioni-btn fusioni-btn-secondary fusioni-dialog-cancel"
            >
              {cancelText || t('common.cancel')}
            </button>
            <button
              onClick={onConfirm}
              className={`fusioni-btn fusioni-dialog-confirm fusioni-dialog-confirm-${variant}`}
            >
              {confirmText || t('common.delete')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
