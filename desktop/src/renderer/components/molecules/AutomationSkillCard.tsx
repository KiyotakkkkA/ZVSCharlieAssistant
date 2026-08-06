import type { AutomationSkill } from "../../../ipc/contracts";
import { EntityStatusBadge, SkillIcon } from "../atoms";
import { ControlButton } from "../atoms/buttons";

interface AutomationSkillCardProps {
  skill: AutomationSkill;
  onEdit: (skill: AutomationSkill) => void;
  onDelete?: (skill: AutomationSkill) => void;
}

export function AutomationSkillCard({
  skill,
  onEdit,
  onDelete,
}: AutomationSkillCardProps) {
  return (
    <article className="relative rounded-xl bg-main-800/30 p-5 ring-1 ring-main-700/40 transition-colors hover:bg-main-800/50 hover:ring-main-600">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-main-700/50 text-main-200">
          <SkillIcon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate font-semibold text-main-100">
              {skill.name}
            </h2>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-main-500">
            {skill.slug}
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-main-400">
            {skill.description}
          </p>
        </div>

        <div className="flex shrink-0">
          <ControlButton
            icon="edit"
            title="Изменить навык"
            onClick={() => onEdit(skill)}
          />
          {!skill.builtin && onDelete ? (
            <ControlButton
              icon="trash"
              title="Удалить навык"
              variant="delete"
              onClick={() => onDelete(skill)}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-main-700/40 pt-4 text-xs text-main-500">
        {skill.builtin ? (
          <span className="rounded-full bg-main-700/60 px-2 py-1 text-xs text-main-300">
            Системный
          </span>
        ) : null}
        <span>{skill.assignedAgentsCount} агентов</span>
        <span>·</span>
        <span>{skill.requiredToolIds.length} инструментов</span>
        <span>·</span>
        <span>v{skill.version}</span>
      </div>
      <EntityStatusBadge status={skill.status} />
    </article>
  );
}
