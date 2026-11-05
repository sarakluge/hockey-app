import { X } from "lucide-react";

export default function PrivacyDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-label="Integritet"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="icon-button modal-close" aria-label="Stäng" onClick={onClose}>
          <X />
        </button>
        <h2>Dina uppgifter på hemmaplan</h2>
        <p>
          Appen planerar lagets hemmamatcher och familjernas arbetsuppgifter. Godkända
          lagmedlemmar kan se familjenamn och bemanning. Endast administratörer kan ändra
          uppgifterna.
        </p>
        <p>
          Vi lagrar e-post, familjekoppling och tilldelade pass. Engångslänkar hanteras av
          Supabase Auth.
        </p>
        <p>
          Kontakta lagets administratör för rättelse, utdrag eller radering. Laget behöver
          ange ansvarig kontakt och gallringstid före skarp användning. Förvara
          exporterade uppgifter privat.
        </p>
        <button className="button primary" onClick={onClose}>
          Jag förstår
        </button>
      </section>
    </div>
  );
}
