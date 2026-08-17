import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";

export interface GlobalSettingRegistration {
  id: string;
  parentId?: string;
  label: string;
  description: string;
  keywords: string[];
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  level: "form" | "anchor";
  element: HTMLElement;
}

interface GlobalSettingsContextValue {
  items: GlobalSettingRegistration[];
  activeFormId: string | null;
  register: (item: GlobalSettingRegistration) => () => void;
  navigate: (id: string) => void;
}

const GlobalSettingsContext = createContext<GlobalSettingsContextValue | null>(
  null,
);

export function GlobalSettingsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<GlobalSettingRegistration[]>([]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const register = useCallback((item: GlobalSettingRegistration) => {
    setItems((current) => [
      ...current.filter(({ id }) => id !== item.id),
      item,
    ]);
    if (item.level === "form") setActiveFormId((current) => current ?? item.id);
    return () =>
      setItems((current) => current.filter(({ id }) => id !== item.id));
  }, []);
  const navigate = useCallback(
    (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) return;
      setActiveFormId(
        item.level === "form" ? item.id : (item.parentId ?? null),
      );
      item.element.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [items],
  );
  const value = useMemo(
    () => ({ items, activeFormId, register, navigate }),
    [items, activeFormId, register, navigate],
  );
  return (
    <GlobalSettingsContext.Provider value={value}>
      {children}
    </GlobalSettingsContext.Provider>
  );
}

export function useGlobalSettings() {
  const value = useContext(GlobalSettingsContext);
  if (!value)
    throw new Error(
      "GlobalSettingsLabel должен находиться внутри GlobalSettingsProvider",
    );
  return value;
}
