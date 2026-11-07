import { useState } from "react";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  helperText?: string;
}

export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  helperText,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      label={label}
      type={visible ? "text" : "password"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      required
      fullWidth
      disabled={disabled}
      helperText={helperText}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={`${visible ? "Dölj" : "Visa"} ${label.toLowerCase()}`}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
                onMouseDown={(event) => event.preventDefault()}
                edge="end"
                disabled={disabled}
              >
                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
