import { useId, useState, type ChangeEvent, type KeyboardEvent } from 'react';

type UploadResult = {
  count?: number;
  message?: string;
  [key: string]: unknown;
};

type BankStatementUploadButtonProps = {
  label?: string;
  inputId?: string;
  scope?: 'personal' | 'family';
  onSuccess?: (result: UploadResult) => void | Promise<void>;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function BankStatementUploadButton({
  label = 'Загрузить PDF-выписку',
  inputId,
  scope = 'personal',
  onSuccess,
}: BankStatementUploadButtonProps) {
  const generatedId = useId();
  const resolvedInputId = inputId || `bank-statement-upload-${generatedId.replace(/:/g, '')}`;
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) return;

    const file = files[0];

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Можно загрузить только PDF-файл');
      event.target.value = '';
      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      alert('Сначала войдите в аккаунт');
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const endpoint =
      scope === 'family'
        ? '/api/family/transactions/upload-pdf'
        : '/api/transactions/upload-pdf';

    setIsUploading(true);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || 'Ошибка обработки файла');
      }

      window.dispatchEvent(new Event('transactions:changed'));

      if (scope === 'family') {
        window.dispatchEvent(new Event('family-transactions:changed'));
      }

      await onSuccess?.(result);
    } catch (error: any) {
      console.error('Ошибка при отправке выписки:', error);
      alert(`Не удалось обработать выписку: ${error.message || 'неизвестная ошибка'}`);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleLabelKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      document.getElementById(resolvedInputId)?.click();
    }
  };

  return (
    <div className="bank-statement-upload">
      <input
        id={resolvedInputId}
        type="file"
        accept="application/pdf,.pdf"
        aria-label={label}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={isUploading}
      />

      <label
        className={`mini-light-button ${isUploading ? 'loading' : ''}`}
        htmlFor={isUploading ? undefined : resolvedInputId}
        role="button"
        tabIndex={0}
        onKeyDown={handleLabelKeyDown}
        style={{ opacity: isUploading ? 0.6 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
      >
        <span className="plus">{isUploading ? '⏳' : '＋'}</span>
        {isUploading ? 'Обработка выписки...' : label}
      </label>
    </div>
  );
}
