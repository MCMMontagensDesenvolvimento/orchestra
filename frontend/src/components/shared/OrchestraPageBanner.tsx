import type { ReactNode } from 'react';

type OrchestraPageBannerProps = {
  children: ReactNode;
  labelledBy?: string;
};

/** Banner institucional das páginas principais. Usar dentro de orchestra-front-page. */
export function OrchestraPageBanner({ children, labelledBy }: OrchestraPageBannerProps) {
  return (
    <section className="orchestra-page-banner" aria-labelledby={labelledBy}>
      <div aria-hidden="true" className="orchestra-banner-wave" />
      {children}
    </section>
  );
}
