import type { CSSProperties } from 'react';
import { BankStatementUploadButton } from './BankStatementUploadButton';

type BankStatementUploadRowProps = {
  align?: 'left' | 'right';
  style?: CSSProperties;
  label?: string;
  onUploadSuccess?: () => void;
};

export function BankStatementUploadRow({
  align = 'left',
  style,
  label,
  onUploadSuccess, // Деструктуризируем его здесь
}: BankStatementUploadRowProps) {
  return (
    <div
      className="chips-row"
      style={{
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        ...style,
      }}
    >
      <BankStatementUploadButton label={label} onSuccess={onUploadSuccess} />
    </div>
  );
}