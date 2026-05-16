import { useId, useState } from 'react';

type BankStatementUploadButtonProps = {
  label?: string;
  inputId?: string;
  onSuccess?: () => void; // Добавляем колбэк для обновления данных
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function BankStatementUploadButton({
  label = 'Загрузить PDF-выписку',
  inputId,
  onSuccess,
}: BankStatementUploadButtonProps) {
  const generatedId = useId();
  const resolvedInputId = inputId || `bank-statement-upload-${generatedId.replace(/:/g, '')}`;
  
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append('file', file); // Ключ 'file' должен совпадать с upload.single('file') на бэкенде

    setIsUploading(false);
    setIsUploading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/transactions/upload-pdf`, {
        method: 'POST',
        headers: {
          // Важно: Content-Type для FormData браузер выставит сам, не пиши его вручную
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка обработки файла');
      }

      const result = await response.json();
      console.log(`Успешно обработано транзакций: ${result.count}`);
      
      // Если передали колбэк, обновляем данные на главной
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Ошибка при отправке выписки:', error);
      alert(`Не удалось обработать выписку: ${error.message}`);
    } finally {
      setIsUploading(false);
      event.target.value = ''; // Сбрасываем инпут, чтобы можно было загрузить тот же файл повторно
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
        htmlFor={resolvedInputId} 
        role="button" 
        tabIndex={0}
        style={{ opacity: isUploading ? 0.6 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
      >
        <span className="plus">{isUploading ? '⏳' : '＋'}</span>
        {isUploading ? 'Обработка выписки...' : label}
      </label>
    </div>
  );
}