import type { CSSProperties } from 'react';
import { BankStatementUploadButton } from './BankStatementUploadButton';

type UploadResult = {
  count?: number;
  message?: string;
  [key: string]: unknown;
};

type BankStatementUploadRowProps = {
  align?: 'left' | 'right';
  style?: CSSProperties;
  label?: string;
  scope?: 'personal' | 'family';
  onUploadSuccess?: (result: UploadResult) => void | Promise<void>;
};

export function BankStatementUploadRow({
  align = 'left',
  style,
  label,
  scope = 'personal',
  onUploadSuccess,
}: BankStatementUploadRowProps) {
  return (
    <div
      className="chips-row"
      style={{
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        ...style,
      }}
    >
      <BankStatementUploadButton label={label} scope={scope} onSuccess={onUploadSuccess} />
    </div>
  );
}
