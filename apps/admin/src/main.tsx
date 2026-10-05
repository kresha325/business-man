import React from "react";
import ReactDOM from "react-dom/client";
import { EdiShell, ediStyles } from "@edi/ui";

function AdminFoundation() {
  return (
    <EdiShell application="Business administration">
      <p className="edi-eyebrow">EDI · BUSINESS PLATFORM</p>
      <h1 className="edi-title">Një qendër për biznesin EDI.</h1>
      <p className="edi-description">
        Administrimi, inventari dhe shitjet do të përdorin të njëjtën API dhe të njëjtat të dhëna.
      </p>
    </EdiShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <style>{ediStyles}</style>
    <AdminFoundation />
  </React.StrictMode>
);
