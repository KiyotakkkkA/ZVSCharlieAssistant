import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Box, Text, useBoxMetrics, type DOMElement } from "ink";
import { commandCatalog } from "../commands";
import { absoluteRect, containsPoint } from "../geometry";
import { tuiColors } from "../theme";
import { scrollbarThumb } from "./Transcript";

export interface HelpPanelHandle {
  scrollBy(lines: number): void;
  pageBy(pages: number): void;
  containsPoint(x: number, y: number): boolean;
  tabAtPoint(x: number, y: number): number | undefined;
}

export const HELP_TABS = ["Помощь", "Общие", "Команды"] as const;

export function HelpPanel({
  activeTab,
  handleRef,
}: {
  activeTab: number;
  handleRef?: RefObject<HelpPanelHandle | null>;
}) {
  const viewportRef = useRef<DOMElement>(null);
  const contentRef = useRef<DOMElement>(null);
  const tabRefs = useRef<Array<DOMElement | null>>([]);
  const viewport = useBoxMetrics(viewportRef);
  const content = useBoxMetrics(contentRef);
  const maxOffset = Math.max(0, content.height - viewport.height);
  const [offset, setOffset] = useState(0);
  const visibleOffset = Math.min(offset, maxOffset);

  useEffect(() => setOffset(0), [activeTab]);
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
      pageBy: (pages: number) =>
        setOffset((current) =>
          Math.max(
            0,
            Math.min(
              maxOffset,
              current + pages * Math.max(1, viewport.height - 2),
            ),
          ),
        ),
      containsPoint: (x: number, y: number) =>
        containsPoint(absoluteRect(viewportRef.current), x, y),
      tabAtPoint: (x: number, y: number) => {
        const index = tabRefs.current.findIndex((tab) =>
          containsPoint(absoluteRect(tab), x, y),
        );
        return index >= 0 ? index : undefined;
      },
    }),
    [maxOffset, viewport.height],
  );

  const thumb = scrollbarThumb(viewport.height, content.height, visibleOffset);

  return (
    <Box
      flexGrow={1}
      minHeight={0}
      flexDirection="column"
      paddingX={2}
      paddingTop={1}
    >
      <Box
        flexShrink={0}
        borderStyle="single"
        borderTop
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        paddingTop={1}
        flexDirection="column"
      >
        <Text bold color={tuiColors.accent}>
          Справка
        </Text>
        <Box gap={2} marginTop={1}>
          {HELP_TABS.map((tab, index) => {
            const active = index === activeTab;
            return (
              <Box
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                key={tab}
              >
                <Text
                  bold={active}
                  color={active ? tuiColors.text : tuiColors.muted}
                  backgroundColor={
                    active ? tuiColors.panelSelected : undefined
                  }
                >
                  {active ? ` ${tab} ` : tab}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box
        ref={viewportRef}
        position="relative"
        flexGrow={1}
        minHeight={0}
        marginTop={1}
        overflowY="hidden"
      >
        <Box
          ref={contentRef}
          position="absolute"
          top={-visibleOffset}
          width="100%"
          flexDirection="column"
          paddingRight={2}
        >
          <HelpTabContent tab={activeTab} />
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
      </Box>
    </Box>
  );
}

function HelpTabContent({ tab }: { tab: number }): ReactNode {
  if (tab === 1)
    return (
      <>
        <SectionTitle>Управление</SectionTitle>
        <HelpRow keys="Tab" text="переключить вкладку справки" />
        <HelpRow keys="← →" text="переключить вкладку справки" />
        <HelpRow keys="↑ ↓ / колесо" text="прокрутить содержимое вкладки" />
        <HelpRow
          keys="PageUp / PageDown"
          text="прокрутить содержимое постранично"
        />
        <HelpRow keys="Esc" text="закрыть справку или меню" />
        <HelpRow keys="Shift+Enter" text="добавить новую строку" />
        <HelpRow
          keys="Ctrl+W / Ctrl+U / Ctrl+K"
          text="удалить слово / до начала / до конца строки"
        />
        <HelpRow keys="Ctrl+← / Ctrl+→" text="перемещаться по словам" />
        <HelpRow keys="Home / End" text="перейти в начало / конец ввода" />
        <HelpRow keys="Ctrl+L" text="перейти к концу ленты" />
        <HelpRow keys="Ctrl+C" text="отменить задачу или выйти" />
      </>
    );

  if (tab === 2)
    return (
      <>
        <SectionTitle>Встроенные команды</SectionTitle>
        {commandCatalog.map((command) => (
          <Box key={command.name} flexDirection="column" marginBottom={1}>
            <Text bold color={tuiColors.accent}>
              {command.name}
              {command.usage ? (
                <Text color={tuiColors.muted}> {command.usage}</Text>
              ) : null}
            </Text>
            <Text color={tuiColors.muted}>  {command.description}</Text>
          </Box>
        ))}
      </>
    );

  return (
    <>
      <SectionTitle>ZVS CLI</SectionTitle>
      <Text color={tuiColors.text}>
        Используйте вкладки, чтобы посмотреть горячие клавиши и встроенные
        команды.
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Text color={tuiColors.accent}>@file путь</Text>
        <Text color={tuiColors.muted}>  прикрепить файл из проекта</Text>
        <Text color={tuiColors.accent}>@skill имя</Text>
        <Text color={tuiColors.muted}>  загрузить навык для следующего запроса</Text>
        <Text color={tuiColors.accent}>! команда</Text>
        <Text color={tuiColors.muted}>  выполнить команду в папке проекта</Text>
      </Box>
    </>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Box marginBottom={1}>
      <Text bold color={tuiColors.text}>
        {children}
      </Text>
    </Box>
  );
}

function HelpRow({ keys, text }: { keys: string; text: string }) {
  return (
    <Box marginBottom={1}>
      <Text color={tuiColors.accent}>{keys}</Text>
      <Text color={tuiColors.muted}> — {text}</Text>
    </Box>
  );
}
