import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Box, Text, useBoxMetrics, useInput, type DOMElement } from "ink";
import type { TranscriptEntry } from "../state";
import { ContentBlock } from "../molecules/ContentBlock";
import { tuiColors } from "../theme";

export interface TranscriptHandle {
  scrollBy(lines: number): void;
  scrollToBottom(): void;
  isScrolled(): boolean;
}

export function Transcript({
  entries,
  emptyContent,
  scrollEnabled = true,
  handleRef,
}: {
  entries: TranscriptEntry[];
  emptyContent?: ReactNode;
  scrollEnabled?: boolean;
  handleRef?: RefObject<TranscriptHandle | null>;
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

  useImperativeHandle(
    handleRef,
    () => ({
      scrollBy: (lines: number) =>
        setOffset((current) =>
          Math.max(0, Math.min(maxOffset, current + lines)),
        ),
      scrollToBottom: () => setOffset(0),
      isScrolled: () => visibleOffset > 0,
    }),
    [maxOffset, visibleOffset],
  );

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

  const thumb = scrollbarThumb(
    viewport.height,
    content.height,
    maxOffset - visibleOffset,
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
        {entries.length
          ? entries.map((entry) => (
              <ContentBlock key={entry.id} entry={entry} />
            ))
          : emptyContent}
      </Box>
      {maxOffset > 0 && thumb ? (
        <Box position="absolute" top={0} right={0} flexDirection="column">
          {Array.from({ length: viewport.height }, (_value, row) => (
            <Text
              key={row}
              color={
                row >= thumb.start && row < thumb.start + thumb.size
                  ? tuiColors.borderActive
                  : tuiColors.panel
              }
            >
              │
            </Text>
          ))}
        </Box>
      ) : null}
      {visibleOffset > 0 ? (
        <Box position="absolute" top={0} right={2}>
          <Text color={tuiColors.subtle}>
            ↑ {visibleOffset} строк от конца · PageDown / колесо — вниз
          </Text>
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

export function scrollbarThumb(
  viewportHeight: number,
  contentHeight: number,
  scrolledLines: number,
): { start: number; size: number } | undefined {
  if (viewportHeight <= 0 || contentHeight <= viewportHeight) return undefined;
  const size = Math.max(
    1,
    Math.round((viewportHeight * viewportHeight) / contentHeight),
  );
  const travel = viewportHeight - size;
  const maxScroll = contentHeight - viewportHeight;
  const start = Math.round((scrolledLines / maxScroll) * travel);
  return { start: Math.max(0, Math.min(travel, start)), size };
}
