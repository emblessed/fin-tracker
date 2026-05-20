import { useState } from 'react';

type ExportButtonProps = {
  fileId: string;
  apiUrl?: string;
};

const DEFAULT_API_URL = '';

function getFileNameFromHeader(header: string | null, fallbackName: string) {
  if (!header) {
    return fallbackName;
  }

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const plainMatch = header.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || fallbackName;
}

export function ExportButton({
  fileId,
  apiUrl = DEFAULT_API_URL,
}: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleDownload() {
    try {
      setIsLoading(true);

      const downloadUrl = `${apiUrl}/files/${fileId}/download`;

      const response = await fetch(downloadUrl, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Не удалось скачать PDF-файл');
      }

      const blob = await response.blob();
      const fileName = getFileNameFromHeader(
        response.headers.get('content-disposition'),
        'export.pdf',
      );

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Не удалось скачать PDF-файл');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="export-button">
      <button
        className="primary-button"
        type="button"
        onClick={handleDownload}
        disabled={isLoading}
      >
        {isLoading ? 'Загрузка...' : 'Экспортировать в PDF'}
      </button>
    </div>
  );
}
