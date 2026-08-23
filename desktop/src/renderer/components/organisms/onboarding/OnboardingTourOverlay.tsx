import { Button, ProgressBar } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { APP_PATHS } from "../../../app/routes";
import { onboardingStore } from "../../../stores";
import { ArrowExpandRightIcon, CheckIcon, ChevronLeftIcon } from "../../atoms";
import { findGuide } from "./guides";

type Rect = { top: number; left: number; width: number; height: number };

export const OnboardingTourOverlay = observer(function OnboardingTourOverlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const guide = findGuide(onboardingStore.activeGuideId);
  const step = guide?.steps[onboardingStore.guideStepIndex];
  const highlightedRect = rect;
  const finishGuide = async () => {
    await onboardingStore.finishGuide();
    navigate(APP_PATHS.guides, { replace: true });
  };

  useEffect(() => {
    if (!onboardingStore.guideActive || !step) return;
    setRect(null);
    setTargetMissing(false);

    if (location.pathname !== step.route) {
      navigate(step.route, { replace: true });
      return;
    }

    let active = true;
    let element: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | undefined;
    let pollTimer: number | undefined;
    let timeoutTimer: number | undefined;
    let prepared = !step.openTarget;

    const update = () => {
      if (!active || !element) return;
      const value = element.getBoundingClientRect();
      setRect({
        top: value.top,
        left: value.left,
        width: value.width,
        height: value.height,
      });
    };

    const connect = (target: HTMLElement) => {
      element = target;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      target.scrollIntoView({ block: "center", inline: "nearest" });
      window.requestAnimationFrame(update);
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(target);
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
    };

    const findTarget = () => {
      if (!prepared && step.openTarget) {
        const action = document.querySelector<HTMLElement>(
          `[data-tour="${step.openTarget}"]`,
        );
        if (!action) return;
        const candidates = action.matches("button, a")
          ? [action]
          : [...action.querySelectorAll<HTMLElement>("button, a")];
        const clickable = step.openLabel
          ? candidates.find((item) =>
              item.textContent?.includes(step.openLabel ?? ""),
            )
          : candidates[0];
        if (!clickable) return;
        clickable.click();
        prepared = true;
        return;
      }
      const target = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`,
      );
      if (target) connect(target);
    };

    findTarget();
    if (!element) pollTimer = window.setInterval(findTarget, 80);
    timeoutTimer = window.setTimeout(() => {
      if (!element && active) {
        window.clearInterval(pollTimer);
        setTargetMissing(true);
        if (step.optional) {
          window.setTimeout(() => {
            if (active) onboardingStore.nextGuideStep();
          }, 500);
        }
      }
    }, 2500);

    return () => {
      active = false;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [location.pathname, navigate, step]);

  useEffect(() => {
    if (!onboardingStore.guideActive) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") onboardingStore.prevGuideStep();
      else if (event.key === "Escape") onboardingStore.closeGuide();
      else if (event.key === "ArrowRight" || event.key === "Enter") {
        if (
          event.key === "Enter" &&
          event.target instanceof HTMLElement &&
          event.target.closest("button, a, input, select, textarea")
        ) {
          return;
        }
        event.preventDefault();
        if (
          guide &&
          onboardingStore.guideStepIndex === guide.steps.length - 1
        ) {
          void finishGuide();
        } else {
          onboardingStore.nextGuideStep();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      previousFocus?.focus();
    };
  }, [guide, onboardingStore.guideActive]);

  useEffect(() => {
    if (onboardingStore.guideActive) dialogRef.current?.focus();
  }, [step?.id]);

  if (!onboardingStore.guideActive || !guide || !step) return null;
  const last = onboardingStore.guideStepIndex === guide.steps.length - 1;
  const tooltipStyle = positionTooltip(highlightedRect, step.placement);

  return createPortal(
    <div className="fixed inset-0 z-10000" aria-hidden={false}>
      {highlightedRect ? (
        <div
          className="pointer-events-none absolute rounded-xl bg-transparent ring-2 ring-accent-light shadow-[0_0_0_9999px_rgb(0_0_0/0.68),0_0_36px_rgb(99_179_237/0.2)] transition-[top,left,width,height] duration-200"
          style={{
            top: highlightedRect.top - 7,
            left: highlightedRect.left - 7,
            width: highlightedRect.width + 14,
            height: highlightedRect.height + 14,
          }}
        >
          <span className="absolute -right-1.5 -top-1.5 size-3 rounded-full bg-accent-light ring-4 ring-accent-medium/20" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/68 backdrop-blur-[1px]" />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-tour-title"
        tabIndex={-1}
        className="absolute w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-main-800 shadow-2xl ring-1 ring-main-600/90 outline-none"
        style={tooltipStyle}
      >
        <div className="h-1 bg-main-700/60">
          <div
            className="h-full bg-accent-light transition-[width] duration-300"
            style={{
              width: `${((onboardingStore.guideStepIndex + 1) / guide.steps.length) * 100}%`,
            }}
          />
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-accent-medium/12 px-2.5 py-1 text-[11px] font-medium text-accent-light">
              {guide.title}
            </span>
            <span className="text-[11px] tabular-nums text-main-500">
              Шаг {onboardingStore.guideStepIndex + 1} из {guide.steps.length}
            </span>
          </div>
          <h2
            id="onboarding-tour-title"
            className="mt-4 text-lg font-semibold tracking-tight text-main-50"
          >
            {step.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-main-300">
            {step.description}
          </p>
          {step.points?.length ? (
            <ul className="mt-4 space-y-2">
              {step.points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2 text-xs leading-5 text-main-400"
                >
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-accent-light" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {targetMissing ? (
            <p className="mt-4 rounded-lg bg-warning-medium/10 px-3 py-2 text-xs text-warning-light">
              Элемент недоступен в текущем состоянии страницы. Можно перейти
              дальше.
            </p>
          ) : null}

          <div className="mt-5 border-t border-main-700/45 pt-4">
            <ProgressBar
              value={onboardingStore.guideStepIndex + 1}
              max={guide.steps.length}
              label={`Шаг ${onboardingStore.guideStepIndex + 1} из ${guide.steps.length}`}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="secondary"
                rounded="rounded-full"
                className="px-2"
                onClick={onboardingStore.closeGuide}
              >
                Выйти из урока
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  rounded="rounded-full"
                  label="Назад"
                  className="size-9 p-0"
                  disabled={onboardingStore.guideStepIndex === 0}
                  onClick={onboardingStore.prevGuideStep}
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <Button
                  variant="primary"
                  rounded="rounded-full"
                  className="px-2"
                  onClick={() =>
                    last ? void finishGuide() : onboardingStore.nextGuideStep()
                  }
                >
                  {last ? "Готово" : "Далее"}
                  {last ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <ArrowExpandRightIcon className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
});

function positionTooltip(
  rect: Rect | null,
  placement: string | undefined,
): CSSProperties {
  const width = Math.min(400, window.innerWidth - 32);
  const estimatedHeight = 470;
  const gap = 20;
  const clampX = (value: number) =>
    Math.max(16, Math.min(window.innerWidth - width - 16, value));
  const clampY = (value: number) =>
    Math.max(16, Math.min(window.innerHeight - estimatedHeight - 16, value));

  if (!rect) {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }
  if (placement === "right") {
    return {
      top: clampY(rect.top + rect.height / 2 - estimatedHeight / 2),
      left: clampX(rect.left + rect.width + gap),
    };
  }
  if (placement === "left") {
    return {
      top: clampY(rect.top + rect.height / 2 - estimatedHeight / 2),
      left: clampX(rect.left - width - gap),
    };
  }
  if (placement === "top") {
    return {
      top: clampY(rect.top - estimatedHeight - gap),
      left: clampX(rect.left + rect.width / 2 - width / 2),
    };
  }
  return {
    top: clampY(rect.top + rect.height + gap),
    left: clampX(rect.left + rect.width / 2 - width / 2),
  };
}
