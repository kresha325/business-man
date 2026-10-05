import React from "react";
import ReactDOM from "react-dom/client";
import { EdiShell, ediStyles } from "@edi/ui";

function StorefrontFoundation() {
  return (
    <EdiShell application="Online store" businessName="ELECTRO & INSTALUES">
      <p className="edi-eyebrow">EDI · ELECTRO &amp; INSTALUES</p>
      <h1 className="edi-title">Zgjidhja profesionale për energji, ndriçim dhe instalime.</h1>
      <p className="edi-description">
        Platforma EDI po vendoset mbi një katalog dhe inventar të përbashkët me dyqanin fizik.
      </p>
    </EdiShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <style>{ediStyles}</style>
    <StorefrontFoundation />
  </React.StrictMode>
);
