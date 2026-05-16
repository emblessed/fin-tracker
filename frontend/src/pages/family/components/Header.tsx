export type HeaderMode = 'family' | 'user';

type HeaderProps = {
  mode?: HeaderMode;
};

// Старый локальный header семейного раздела больше не должен рендериться.
// Общий header подключается один раз через App.tsx -> PageWithHeader.
export function Header({ mode: _mode }: HeaderProps) {
  return null;
}
