import { useEffect, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent } from 'react';

type StoredFile = {
  _id: string;
  originalName: string;
  filename: string;
  size: number;
  uploadDate: string;
};

const API_URL = '';

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default  function AdminUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [message, setMessage] = useState('');

  async function loadFiles() {
    try {
      setIsLoadingFiles(true);
    const response = await fetch(`${API_URL}/api/files`);

      if (!response.ok) {
        throw new Error('Не удалось получить список файлов');
      }

      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('Files load failed:', error);
      setMessage('Не удалось загрузить список PDF');
    } finally {
      setIsLoadingFiles(false);
    }
  }

  useEffect(() => {
    loadFiles();
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setMessage('Сначала выбери PDF-файл');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setIsUploading(true);
      setMessage('');

      const response = await fetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Ошибка загрузки PDF');
      }

      setMessage(`Файл "${data.file.originalName}" успешно загружен`);
      setSelectedFile(null);
      await loadFiles();
    } catch (error) {
      console.error('Upload failed:', error);
      setMessage(error instanceof Error ? error.message : 'Не удалось загрузить PDF');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Тестовая загрузка PDF</h1>
        <p style={styles.subtitle}>
          Страница отправляет файл на <code>{API_URL}/files/upload</code> и получает список из <code>{API_URL}/files</code>.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            style={styles.input}
          />

          <button
            type="submit"
            disabled={isUploading || !selectedFile}
            style={styles.button}
          >
            {isUploading ? 'Загрузка...' : 'Загрузить PDF'}
          </button>
        </form>

        {selectedFile && (
          <p style={styles.fileInfo}>
            Выбран файл: <strong>{selectedFile.name}</strong>
          </p>
        )}

        {message && (
          <p style={styles.message}>
            {message}
          </p>
        )}

        <div style={styles.listBlock}>
          <h2 style={styles.listTitle}>Файлы в базе</h2>

          {isLoadingFiles ? (
            <p style={styles.emptyState}>Загрузка списка...</p>
          ) : files.length === 0 ? (
            <p style={styles.emptyState}>Пока нет загруженных PDF</p>
          ) : (
            <ul style={styles.list}>
              {files.map((file) => (
                <li key={file._id} style={styles.listItem}>
                  <div>
                    <div style={styles.fileName}>{file.originalName}</div>
                    <div style={styles.meta}>
                      ID: {file._id}
                    </div>
                    <div style={styles.meta}>
                      Размер: {formatFileSize(file.size)}
                    </div>
                  </div>
                  <a
                    href={`${API_URL}/api/files/${file._id}/download`}
                    style={styles.link}
                  >
                    Скачать
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '32px 16px',
    background: '#f3f4f6',
    fontFamily: 'Segoe UI, sans-serif',
  },
  card: {
    maxWidth: '720px',
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '28px',
    color: '#111827',
  },
  subtitle: {
    margin: '0 0 24px',
    color: '#4b5563',
    lineHeight: 1.5,
  },
  form: {
    display: 'grid',
    gap: '12px',
    marginBottom: '16px',
  },
  input: {
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '12px',
    background: '#f9fafb',
  },
  button: {
    border: 'none',
    borderRadius: '12px',
    padding: '12px 16px',
    background: '#0f766e',
    color: '#ffffff',
    fontSize: '16px',
    cursor: 'pointer',
  },
  fileInfo: {
    margin: '0 0 8px',
    color: '#1f2937',
  },
  message: {
    margin: '0 0 20px',
    color: '#1d4ed8',
  },
  listBlock: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '20px',
  },
  listTitle: {
    margin: '0 0 12px',
    fontSize: '20px',
    color: '#111827',
  },
  emptyState: {
    margin: 0,
    color: '#6b7280',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '12px',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    padding: '14px 16px',
    borderRadius: '14px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
  },
  fileName: {
    fontWeight: 600,
    color: '#111827',
    marginBottom: '6px',
  },
  meta: {
    fontSize: '13px',
    color: '#6b7280',
  },
  link: {
    color: '#0f766e',
    textDecoration: 'none',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};
