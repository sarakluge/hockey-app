import { Fragment } from "react";
import { Box, Typography } from "@mui/material";

function inline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
}

export default function InstructionText({
  text,
  columns = false,
}: {
  text: string;
  columns?: boolean;
}) {
  const sections: { heading: string; lines: string[] }[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const heading = line.trim().match(/^(?:\*\*(.+)\*\*|#{1,4}\s+(.+))$/);
    if (heading) sections.push({ heading: heading[1] || heading[2], lines: [] });
    else {
      if (!sections.length) sections.push({ heading: "", lines: [] });
      sections[sections.length - 1].lines.push(line);
    }
  }
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns:
          columns && sections.length > 1
            ? { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }
            : "1fr",
        gap: 2.5,
      }}
    >
      {sections.map((section, sectionIndex) => {
        const blocks: {
          type: "paragraph" | "ul" | "ol";
          lines: string[];
          start?: number;
        }[] = [];
        for (const line of section.lines) {
          const bullet = line.trim().match(/^(?:[-*•]\s+|\d+[.)]\s+)(.*)$/);
          const number = line.trim().match(/^(\d+)[.)]\s+/);
          const type = bullet ? (number ? "ol" : "ul") : "paragraph";
          if (!line.trim()) {
            blocks.push({ type: "paragraph", lines: [] });
            continue;
          }
          const last = blocks.at(-1);
          if (last && last.type === type) last.lines.push(bullet ? bullet[1] : line);
          else
            blocks.push({
              type,
              lines: [bullet ? bullet[1] : line],
              start: number ? Number(number[1]) : undefined,
            });
        }
        return (
          <Box key={sectionIndex} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
            {section.heading && (
              <Typography
                component="h4"
                sx={{ fontWeight: 700, fontSize: "1rem", mb: 1 }}
              >
                {inline(section.heading)}
              </Typography>
            )}
            {blocks
              .filter((block) => block.lines.length)
              .map((block, index) =>
                block.type === "paragraph" ? (
                  <Typography
                    key={index}
                    sx={{ lineHeight: 1.7, whiteSpace: "pre-wrap", "& + p": { mt: 1 } }}
                  >
                    {inline(block.lines.join("\n"))}
                  </Typography>
                ) : (
                  <Box
                    key={index}
                    component={block.type}
                    {...(block.type === "ol" ? { start: block.start } : {})}
                    sx={{ pl: 2.5, my: 0.5, lineHeight: 1.7, "& li + li": { mt: 0.5 } }}
                  >
                    {block.lines.map((line, lineIndex) => (
                      <li key={lineIndex}>{inline(line)}</li>
                    ))}
                  </Box>
                ),
              )}
          </Box>
        );
      })}
    </Box>
  );
}
