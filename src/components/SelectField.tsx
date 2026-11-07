import { TextField, type TextFieldProps } from "@mui/material";

// MUI field with the device's native selection menu and a visible, linked label.
export default function SelectField(props: TextFieldProps) {
  return (
    <TextField {...props} select fullWidth slotProps={{ select: { native: true } }} />
  );
}
