import { ChartsColumn } from './ChartsColumn';
import { Footer } from './Footer';
import { LeftDashboardColumn } from './LeftDashboardColumn';

export type HeaderMode = 'family' | 'user';

type DashboardLayoutProps = {
  headerMode?: HeaderMode;
};

export function DashboardLayout({ headerMode: _headerMode }: DashboardLayoutProps) {
  return (
    <>
      <div className="dashboard-grid">
        <LeftDashboardColumn />
        <ChartsColumn />
      </div>

      <Footer />
    </>
  );
}
