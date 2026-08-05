import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  InputBig,
  InputCheckBox,
  InputCheckBoxGroup,
  InputSmall,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import type {
  AutomationSkill,
} from "../../../../ipc/contracts";
import type {
  AutomationStatus,
  UpsertAutomationSkillInput,
} from "../../../../shared/dto";
import { automationStore } from "../../../stores";
import { Field, ParameterLabel } from "../../atoms";
import { PrimaryButton } from "../../atoms/buttons";

export const AutomationSkillManageForm = observer(
  function AutomationSkillManageForm({
    model,
    submitting,
    onCancel,
    onSubmit,
    readOnly = false,
  }: {
    model?: AutomationSkill;
    submitting?: boolean;
    onCancel(): void;
    onSubmit(input: UpsertAutomationSkillInput): void | Promise<void>;
    readOnly?: boolean;
  }) {
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [instructions, setInstructions] = useState("");
    const [status, setStatus] = useState<AutomationStatus>("draft");
    const [version, setVersion] = useState("1.0.0");
    const [author, setAuthor] = useState("");
    const [tools, setTools] = useState<Record<string, boolean>>({});
    useEffect(() => {
      setName(model?.name ?? "");
      setSlug(model?.slug ?? "");
      setDescription(model?.description ?? "");
      setInstructions(model?.instructions ?? "");
      setStatus(model?.status ?? "draft");
      setVersion(model?.version ?? "1.0.0");
      setAuthor(model?.author ?? "");
      setTools(
        Object.fromEntries(
          automationStore.tools.map((tool) => [
            tool.id,
            model?.requiredToolIds.includes(tool.id) ?? false,
          ]),
        ),
      );
    }, [model, automationStore.tools]);
    const requiredToolIds = useMemo(
      () =>
        Object.entries(tools)
          .filter(([, v]) => v)
          .map(([id]) => id),
      [tools],
    );
    return (
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (readOnly) return;
          void onSubmit({
            id: model?.id,
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim(),
            instructions: instructions.trim(),
            status,
            version: version.trim(),
            author: author.trim(),
            requiredToolIds,
          });
        }}
      >
        <section className="grid gap-4 rounded-xl bg-main-800/20 p-5 ring-1 ring-main-700/35 md:grid-cols-2">
          <Field
            label={
              <ParameterLabel description="Отображаемое название навыка в списках и настройках агентов.">
                Название
              </ParameterLabel>
            }
          >
            <InputSmall
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Анализ юридического документа"
              required
              disabled={readOnly}
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Уникальное имя директории навыка. Допустимы строчные латинские буквы, цифры и дефисы.">
                Идентификатор
              </ParameterLabel>
            }
          >
            <InputSmall
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                )
              }
              placeholder="legal-document-review"
              required
              disabled={readOnly}
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Кратко объясняет модели, когда следует применять навык. Это описание попадает в каталог доступных навыков.">
                Описание
              </ParameterLabel>
            }
            className="md:col-span-2"
          >
            <InputSmall
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Когда и для каких задач применять навык"
              required
              disabled={readOnly}
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Версия содержимого навыка. Обновляйте её при существенном изменении инструкций или результата.">
                Версия
              </ParameterLabel>
            }
          >
            <InputSmall
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              disabled={readOnly}
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Автор или команда, отвечающие за поддержку навыка.">
                Автор
              </ParameterLabel>
            }
          >
            <InputSmall
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Необязательно"
              disabled={readOnly}
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Активные навыки доступны агентам. Черновики и отключённые навыки не загружаются во время выполнения.">
                Статус
              </ParameterLabel>
            }
            className="w-fit"
          >
            <Select
              disabled={readOnly}
              value={status}
              onChange={(value) => setStatus(value as AutomationStatus)}
              options={[
                { value: "draft", label: "Черновик" },
                { value: "active", label: "Активен" },
                { value: "disabled", label: "Отключён" },
              ]}
            >
              <Select.Trigger />
              <Select.Menu>
                <Select.Option value="draft" label="Черновик" />
                <Select.Option value="active" label="Активен" />
                <Select.Option value="disabled" label="Отключён" />
              </Select.Menu>
            </Select>
          </Field>
        </section>
        <section className="rounded-xl bg-main-800/20 p-5 ring-1 ring-main-700/35">
          <h2 className="mb-1 text-sm font-semibold">
            <ParameterLabel description="Полное содержимое SKILL.md: цель, последовательность действий, ограничения и формат итогового результата.">
              Инструкции навыка
            </ParameterLabel>
          </h2>
          <p className="mb-4 text-xs text-main-500">
            Опишите цель, порядок действий, ограничения и формат результата.
          </p>
          <InputBig
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            minRows={12}
            maxRows={24}
            autoResize
            showCount
            required
            disabled={readOnly}
          />
        </section>
        <section className="rounded-xl bg-main-800/20 p-5 ring-1 ring-main-700/35">
          <h2 className="mb-1 text-sm font-semibold">
            <ParameterLabel description="Инструменты, без которых инструкции навыка не могут быть выполнены. Их также потребуется разрешить назначенному агенту.">
              Необходимые инструменты
            </ParameterLabel>
          </h2>
          <p className="mb-4 text-xs text-main-500">
            При назначении навыка агенту эти инструменты должны быть разрешены
            отдельно.
          </p>
          <InputCheckBoxGroup
            model={tools}
            onModelChange={setTools}
            multiple
            orientation="vertical"
            className="grid gap-2 md:grid-cols-2"
          >
            {automationStore.tools.map((tool) => (
              <InputCheckBox
                key={tool.id}
                modelValue={tool.id}
                disabled={!tool.enabled || readOnly}
                className="rounded-lg bg-main-800/40 p-3 ring-1 ring-main-700/45"
              >
                <span>
                  <span className="block text-sm">{tool.name}</span>
                  <span className="text-xs text-main-500">{tool.id}</span>
                </span>
              </InputCheckBox>
            ))}
          </InputCheckBoxGroup>
        </section>
        <div className="flex justify-end gap-2 border-t border-main-800 pt-5">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {readOnly ? "Назад" : "Отмена"}
          </Button>
          {!readOnly ? (
            <PrimaryButton
              type="submit"
              loading={submitting}
              disabled={
                submitting ||
                !name.trim() ||
                !slug.trim() ||
                !description.trim() ||
                !instructions.trim()
              }
              label="Сохранить"
            />
          ) : null}
        </div>
      </form>
    );
  },
);
