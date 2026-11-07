import type { ReactNode } from "react";
import { Chip } from "@mui/material";

export default function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  const color =
    tone === "purple"
      ? "secondary"
      : tone === "amber"
        ? "warning"
        : tone === "green"
          ? "success"
          : "primary";
  return (
    <Chip
      size="small"
      color={color}
      variant={tone === "amber" || tone === "green" ? "outlined" : "filled"}
      label={
        <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
          {children}
        </span>
      }
    />
  );
}
