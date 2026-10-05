import type { ReactNode } from "react";

export function EdiShell({
  application,
  businessName = "BUSINESS PLATFORM",
  children
}: {
  application: string;
  businessName?: string;
  children: ReactNode;
}) {
  return (
    <main className="edi-shell">
      <header className="edi-header">
        <a className="edi-brand" href="/" aria-label="EDI home">
          <span className="edi-mark">EDI</span>
          <span className="edi-name">{businessName}</span>
        </a>
        <span className="edi-app-label">{application}</span>
      </header>
      <section className="edi-content">{children}</section>
      <footer className="edi-footer">Professional electrical supply</footer>
    </main>
  );
}

export const ediStyles = `
  :root { font-family: Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: #f5f7fa; background: #10151b; font-synthesis: none; }
  * { box-sizing: border-box; }
  body { margin: 0; min-width: 320px; min-height: 100vh; }
  .edi-shell { min-height: 100vh; display: flex; flex-direction: column; background: radial-gradient(ellipse at 78% 8%, #1b2b3c 0, #10151b 52%); }
  .edi-header { min-height: 76px; padding: 0 clamp(20px, 6vw, 88px); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ffffff16; }
  .edi-brand { display: flex; align-items: center; gap: 13px; color: inherit; text-decoration: none; }
  .edi-mark { color: #79bdff; font-size: 28px; font-weight: 850; letter-spacing: .1em; }
  .edi-name { color: #aeb8c4; font-size: 10px; font-weight: 700; letter-spacing: .14em; }
  .edi-app-label { color: #c4d0dd; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
  .edi-content { width: min(100% - 40px, 1120px); margin: auto; padding: 88px 0; }
  .edi-footer { padding: 24px clamp(20px, 6vw, 88px); border-top: 1px solid #ffffff16; color: #8190a0; font-size: 12px; }
  .edi-eyebrow { color: #f0c75e; font-size: 12px; font-weight: 750; letter-spacing: .2em; text-transform: uppercase; }
  .edi-title { max-width: 760px; margin: 20px 0; font-size: clamp(38px, 7vw, 76px); line-height: 1.02; letter-spacing: -.045em; }
  .edi-description { max-width: 620px; color: #acb7c2; font-size: 17px; line-height: 1.7; }
  @media (max-width: 600px) { .edi-header { min-height: 66px; } .edi-name { display: none; } .edi-content { padding: 64px 0; } }
`;
