import React from "react";
import ReactDOM from "react-dom/client";
import { EdiShell, ediStyles } from "@edi/ui";

function PosFoundation() {
  return (
    <EdiShell application="Point of sale">
      <p className="edi-eyebrow">EDI · POS FOUNDATION</p>
      <h1 className="edi-title">Shitje të sigurta, edhe pa internet.</h1>
      <p className="edi-description">
        Ndërfaqja POS do të lidhet me shërbimet qendrore dhe më vonë do të zgjerohet me SQLite lokal
        për punë offline.
      </p>
    </EdiShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <style>{ediStyles}</style>
    <PosFoundation />
  </React.StrictMode>
);
