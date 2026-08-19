import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";

export interface GlobalSettingsAnchorDescriptor {
  id: string;
  parentId: string;
  label: string;
  description?: string;
  keywords?: string[];
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface GlobalSettingsFormDescriptor {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  anchors?: GlobalSettingsAnchorDescriptor[];
  Component: ComponentType;
}

export interface GlobalSettingRegistration {
  id: string;
  parentId?: string;
  label: string;
  description: string;
  keywords: string[];
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  element: HTMLElement;
}

interface GlobalSettingsContextValue {
  forms: GlobalSettingsFormDescriptor[];
  activeFormId: string;
  activeForm: GlobalSettingsFormDescriptor | undefined;
  register: (item: GlobalSettingRegistration) => () => void;
  navigate: (id: string) => void;
}

const GlobalSettingsContext = createContext<GlobalSettingsContextValue | null>(
  null,
);

export function GlobalSettingsProvider({
  forms,
  children,
}: {
  forms: GlobalSettingsFormDescriptor[];
  children: ReactNode;
}) {
  const elements = useRef(new Map<string, HTMLElement>());
  const [registered, setRegistered] = useState(0);
  const [activeFormId, setActiveFormId] = useState(forms[0]?.id ?? "");
  const [pendingAnchorId, setPendingAnchorId] = useState<string | null>(null);

  const register = useCallback((item: GlobalSettingRegistration) => {
    elements.current.set(item.id, item.element);
    setRegistered((value) => value + 1);
    return () => {
      elements.current.delete(item.id);
      setRegistered((value) => value + 1);
    };
  }, []);

  const scrollTo = useCallback((id: string) => {
    const element = elements.current.get(id);
    if (!element) return false;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }, []);

  const navigate = useCallback(
    (id: string) => {
      const parent = forms.find(
        (form) => form.id === id || form.anchors?.some((a) => a.id === id),
      );
      if (!parent) return;
      setActiveFormId(parent.id);
      if (parent.id === id) {
        setPendingAnchorId(null);
        return;
      }
      if (!scrollTo(id)) setPendingAnchorId(id);
    },
    [forms, scrollTo],
  );

  useEffect(() => {
    if (!pendingAnchorId) return;
    if (scrollTo(pendingAnchorId)) setPendingAnchorId(null);
  }, [pendingAnchorId, registered, scrollTo]);

  const value = useMemo(
    () => ({
      forms,
      activeFormId,
      activeForm: forms.find((form) => form.id === activeFormId) ?? forms[0],
      register,
      navigate,
    }),
    [forms, activeFormId, register, navigate],
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
