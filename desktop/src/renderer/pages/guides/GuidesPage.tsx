import { Button, ProgressBar } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import {
  ArrowExpandRightIcon,
  CheckIcon,
  PlayCircleIcon,
} from "../../components/atoms";
import {
  GUIDES,
  findGuide,
} from "../../components/organisms/onboarding/guides";
import { onboardingStore } from "../../stores";

export const GuidesPage = observer(function GuidesPage() {
  const completed = GUIDES.filter((guide) =>
    onboardingStore.isGuideCompleted(guide.id),
  ).length;

  return (
    <div className="mx-auto w-full max-w-360 space-y-6 p-5 xl:p-7">
      <section className="overflow-hidden rounded-2xl bg-main-800/55 p-6 ring-1 ring-main-700/45">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent-light">
              Знакомство с приложением
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-main-50">
              Осваивайте возможности небольшими шагами
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-main-300">
              Каждый урок посвящён одной задаче и занимает несколько минут.
              Проходите их в удобном порядке.
            </p>
          </div>
          <div className="rounded-xl bg-main-900/35 p-4 ring-1 ring-main-700/40">
            <ProgressBar
              value={completed}
              max={GUIDES.length}
              label={`Пройдено ${completed} из ${GUIDES.length}`}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-main-100">Все уроки</h2>
            <p className="mt-1 text-xs text-main-400">
              Сначала познакомьтесь с основами, затем переходите к более сложным
              возможностям.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {GUIDES.map((guide, index) => {
            const done = onboardingStore.isGuideCompleted(guide.id);
            const recommendations = guide.recommendedBefore
              ?.map((id) => findGuide(id))
              .filter(
                (item) => item && !onboardingStore.isGuideCompleted(item.id),
              );
            const Icon = guide.icon;
            return (
              <article
                key={guide.id}
                className="flex min-h-72 flex-col rounded-2xl bg-main-800/45 p-5 ring-1 ring-main-700/45 transition-colors hover:bg-main-800/65"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-main-700/55 text-main-100">
                    <Icon className="size-5" />
                  </span>
                  {done ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-medium/10 px-2.5 py-1 text-[11px] font-medium text-success-light">
                      <CheckIcon className="size-3.5" />
                      Пройден
                    </span>
                  ) : (
                    <span className="rounded-full bg-main-700/45 px-2.5 py-1 text-[11px] text-main-400">
                      {guide.duration}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-medium text-main-500">
                    Урок {index + 1}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-main-100">
                    {guide.title}
                  </h3>
                  <p className="mt-2 text-sm leading-5 text-main-400">
                    {guide.description}
                  </p>
                </div>
                <p className="mt-4 rounded-lg bg-main-900/30 px-3 py-2.5 text-xs leading-5 text-main-300">
                  {guide.result}
                </p>
                <div className="mt-auto pt-4">
                  {recommendations?.length ? (
                    <p className="mb-3 text-[11px] leading-4 text-main-500">
                      Перед этим полезно пройти:{" "}
                      {recommendations.map((item) => item?.title).join(", ")}.
                    </p>
                  ) : null}
                  <Button
                    variant={done ? "secondary" : "primary"}
                    rounded="rounded-full"
                    className="w-full px-2"
                    onClick={() => onboardingStore.startGuide(guide.id)}
                  >
                    {done ? "Пройти ещё раз" : "Начать урок"}
                    {done && <PlayCircleIcon className="size-4" />}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
});
