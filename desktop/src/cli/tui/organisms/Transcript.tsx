import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Text,
  useBoxMetrics,
  useInput,
  type DOMElement,
} from "ink";
import type { TranscriptEntry } from "../state";
import { ContentBlock } from "../molecules/ContentBlock";
import { tuiColors } from "../theme";

export function Transcript({
  entries,
  emptyContent,
  scrollEnabled = true,
}: {
  entries: TranscriptEntry[];
  emptyContent?: ReactNode;
  scrollEnabled?: boolean;
}) {
  const viewportRef = useRef<DOMElement>(null);
  const contentRef = useRef<DOMElement>(null);
  const viewport = useBoxMetrics(viewportRef);
  const content = useBoxMetrics(contentRef);
  const maxOffset = maximumScrollOffset(content.height, viewport.height);
  const [offset, setOffset] = useState(0);
  const visibleOffset = Math.min(offset, maxOffset);

  useEffect(() => {
    setOffset((current) => Math.min(current, maxOffset));
  }, [maxOffset]);

  useInput(
    (_input, key) => {
      const page = Math.max(1, viewport.height - 2);
      if (key.pageUp)
        setOffset((current) => Math.min(maxOffset, current + page));
      else if (key.pageDown)
        setOffset((current) => Math.max(0, current - page));
    },
    { isActive: scrollEnabled && maxOffset > 0 },
  );

  return (
    <Box
      ref={viewportRef}
      position="relative"
      flexGrow={1}
      minHeight={0}
      overflowY="hidden"
    >
      <Box
        ref={contentRef}
        position="absolute"
        bottom={-visibleOffset}
        width="100%"
        minHeight="100%"
        flexDirection="column"
        justifyContent="flex-end"
      >
        {entries.length ? (
          entries.map((entry) => (
            <ContentBlock key={entry.id} entry={entry} />
          ))
        ) : (
          emptyContent
        )}
      </Box>
      {visibleOffset > 0 ? (
        <Box position="absolute" top={0} right={1}>
          <Text color={tuiColors.muted}>
            ↑ {visibleOffset} строк от конца · PageDown вернуться
          </Text>
        </Box>
      ) : maxOffset > 0 ? (
        <Box position="absolute" top={0} right={1}>
          <Text color={tuiColors.muted}>PageUp · история</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export function maximumScrollOffset(
  contentHeight: number,
  viewportHeight: number,
): number {
  return Math.max(0, contentHeight - viewportHeight);
}
