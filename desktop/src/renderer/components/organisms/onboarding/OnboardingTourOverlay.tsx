import { Button } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { onboardingStore } from "../../../stores";
import { TOUR_STEPS } from "./tour-steps";

type Rect = { top: number; left: number; width: number; height: number };

export const OnboardingTourOverlay = observer(function OnboardingTourOverlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState<Rect | null>(null);
  const step = TOUR_STEPS[onboardingStore.tourStepIndex];

  useEffect(() => {
    if (!onboardingStore.tourActive || !step) return;
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return;
    }
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const startedAt = Date.now();
    const findTarget = () => {
      if (cancelled) return;
      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!element) {
        if (Date.now() - startedAt < 1500) window.setTimeout(findTarget, 80);
        else if (step.optional) onboardingStore.nextTourStep();
        else setRect(null);
        return;
      }
      element.scrollIntoView({ block: "center" });
      const update = () => {
        const value = element.getBoundingClientRect();
        setRect({ top: value.top, left: value.left, width: value.width, height: value.height });
      };
      update();
      observer = new ResizeObserver(update);
      observer.observe(element);
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
      return () => {
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
      };
    };
    const cleanup = findTarget();
    return () => {
      cancelled = true;
      observer?.disconnect();
      cleanup?.();
    };
  }, [location.pathname, navigate, step]);

  useEffect(() => {
    if (!onboardingStore.tourActive) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") onboardingStore.prevTourStep();
      else if (event.key === "Escape") void onboardingStore.finishTour();
      else if (event.key === "ArrowRight" || event.key === "Enter") {
        if (onboardingStore.tourStepIndex === TOUR_STEPS.length - 1) void onboardingStore.finishTour();
        else onboardingStore.nextTourStep();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onboardingStore.tourActive]);

  if (!onboardingStore.tourActive || !step) return null;
  const tooltipStyle = positionTooltip(rect, step.placement);
  return createPortal(
    <div className="fixed inset-0 z-[10000] pointer-events-none" aria-live="polite">
      {rect ? <div className="absolute rounded-xl ring-2 ring-primary-light" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: "0 0 0 9999px rgba(0,0,0,.68)" }} /> : <div className="absolute inset-0 bg-black/65" />}
      <div className="pointer-events-auto absolute w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-main-800 p-5 shadow-2xl ring-1 ring-main-600" style={tooltipStyle}>
        <div className="text-xs text-main-500">Шаг {onboardingStore.tourStepIndex + 1} из {TOUR_STEPS.length}</div>
        <h2 className="mt-2 text-base font-semibold text-main-50">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-main-300">{step.description}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => void onboardingStore.finishTour()}>Пропустить тур</Button>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={onboardingStore.tourStepIndex === 0} onClick={onboardingStore.prevTourStep}>Назад</Button>
            <Button variant="primary" onClick={() => onboardingStore.tourStepIndex === TOUR_STEPS.length - 1 ? void onboardingStore.finishTour() : onboardingStore.nextTourStep()}>{onboardingStore.tourStepIndex === TOUR_STEPS.length - 1 ? "Готово" : "Далее"}</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
});

function positionTooltip(rect: Rect | null, placement: string | undefined): React.CSSProperties {
  if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  const gap = 18;
  if (placement === "right") return { top: Math.max(16, rect.top), left: Math.min(window.innerWidth - 368, rect.left + rect.width + gap) };
  if (placement === "left") return { top: Math.max(16, rect.top), left: Math.max(16, rect.left - 368 - gap) };
  if (placement === "top") return { top: Math.max(16, rect.top - 220 - gap), left: Math.max(16, Math.min(window.innerWidth - 368, rect.left)) };
  return { top: Math.min(window.innerHeight - 230, rect.top + rect.height + gap), left: Math.max(16, Math.min(window.innerWidth - 368, rect.left)) };
}
