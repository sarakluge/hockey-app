import { Close } from "@mui/icons-material";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
} from "@mui/material";

export default function PrivacyDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="privacy-title"
      aria-describedby="privacy-description"
    >
      <DialogTitle id="privacy-title" sx={{ pr: 7 }}>
        Dina uppgifter på hemmaplan
      </DialogTitle>
      <IconButton
        aria-label="Stäng"
        onClick={onClose}
        sx={{ position: "absolute", top: 8, right: 8 }}
      >
        <Close />
      </IconButton>
      <DialogContent id="privacy-description">
        <DialogContentText component="p" sx={{ mb: 2 }}>
          Appen planerar lagets hemmamatcher och familjernas arbetsuppgifter. Godkända
          lagmedlemmar kan se spelarnamn och bemanning. Endast administratörer kan ändra
          uppgifterna.
        </DialogContentText>
        <DialogContentText component="p" sx={{ mb: 2 }}>
          Vi lagrar förälderns namn, barnets namn, e-post, spelarkoppling och tilldelade
          pass. Engångslänkar hanteras av Supabase Auth.
        </DialogContentText>
        <DialogContentText>
          Kontakta lagets administratör för rättelse, utdrag eller radering. Laget behöver
          ange ansvarig kontakt och gallringstid före skarp användning. Förvara
          exporterade uppgifter privat.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Jag förstår
        </Button>
      </DialogActions>
    </Dialog>
  );
}
