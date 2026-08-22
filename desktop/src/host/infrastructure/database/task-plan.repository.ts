import type Database from "better-sqlite3";
import type { TaskItem, TaskPlan } from "../../../shared/models/task-plan";
import type { TaskItemInput } from "../../../shared/dto";
import { newEntityId } from "./entity-id";

interface PlanRow {
  id: string;
  conversation_id: string | null;
  execution_id: string | null;
  updated_at: string;
}

interface ItemRow {
  id: string;
  position: number;
  subject: string;
  detail: string;
  status: TaskItem["status"];
  updated_at: string;
}

export type TaskPlanScope =
  { conversationId: string } | { executionId: string };

export class TaskPlanRepository {
  constructor(private readonly db: Database.Database) {}

  find(scope: TaskPlanScope): TaskPlan | undefined {
    const row = (
      "conversationId" in scope
        ? this.db
            .prepare("SELECT * FROM task_plans WHERE conversation_id=?")
            .get(scope.conversationId)
        : this.db
            .prepare("SELECT * FROM task_plans WHERE execution_id=?")
            .get(scope.executionId)
    ) as PlanRow | undefined;
    return row ? this.withItems(row) : undefined;
  }

  replace(scope: TaskPlanScope, items: TaskItemInput[]): TaskPlan {
    return this.db.transaction(() => {
      const existing = this.find(scope);
      const planId = existing?.id ?? newEntityId();
      if (!existing)
        this.db
          .prepare(
            "INSERT INTO task_plans(id,conversation_id,execution_id) VALUES(?,?,?)",
          )
          .run(
            planId,
            "conversationId" in scope ? scope.conversationId : null,
            "executionId" in scope ? scope.executionId : null,
          );
      this.db.prepare("DELETE FROM task_items WHERE plan_id=?").run(planId);
      const insert = this.db.prepare(
        `INSERT INTO task_items(id,plan_id,position,subject,detail,status)
         VALUES(?,?,?,?,?,?)`,
      );
      items.forEach((item, index) =>
        insert.run(newEntityId(), planId, index, item.subject, item.detail, item.status),
      );
      this.db
        .prepare(
          "UPDATE task_plans SET updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .run(planId);
      return this.find(scope)!;
    })();
  }

  updateItemStatus(
    scope: TaskPlanScope,
    position: number,
    status: TaskItem["status"],
  ): TaskPlan {
    const plan = this.find(scope);
    if (!plan) throw new Error("План задач не найден");
    const result = this.db
      .prepare(
        `UPDATE task_items SET status=?, updated_at=CURRENT_TIMESTAMP
         WHERE plan_id=? AND position=?`,
      )
      .run(status, plan.id, position);
    if (!result.changes) throw new Error("Задача не найдена");
    this.db
      .prepare("UPDATE task_plans SET updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(plan.id);
    return this.find(scope)!;
  }

  clear(scope: TaskPlanScope): void {
    const plan = this.find(scope);
    if (plan) this.db.prepare("DELETE FROM task_plans WHERE id=?").run(plan.id);
  }

  private withItems(row: PlanRow): TaskPlan {
    const items = (
      this.db
        .prepare("SELECT * FROM task_items WHERE plan_id=? ORDER BY position")
        .all(row.id) as ItemRow[]
    ).map((item): TaskItem => ({
      id: item.id,
      position: item.position,
      subject: item.subject,
      detail: item.detail,
      status: item.status,
      updatedAt: item.updated_at,
    }));
    return {
      id: row.id,
      conversationId: row.conversation_id,
      executionId: row.execution_id,
      items,
      updatedAt: row.updated_at,
    };
  }
}
