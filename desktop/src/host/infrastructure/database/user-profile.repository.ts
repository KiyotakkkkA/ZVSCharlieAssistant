import type Database from "better-sqlite3";
import type { UserProfile } from "../../../shared/models/user-profile";
import type { UpsertUserProfileInput } from "../../../shared/dto";
import { GLOBAL_ENTITY_IDS } from "../../../shared/entity-ids";

interface UserProfileRow {
  display_name: string;
  instructions: string;
  style: string;
  updated_at: string;
}

export class UserProfileRepository {
  constructor(private readonly database: Database.Database) {}

  get(): UserProfile {
    const row = this.database
      .prepare(
        `SELECT display_name,instructions,style,updated_at
         FROM user_profile WHERE id=?`,
      )
      .get(GLOBAL_ENTITY_IDS.userProfile) as UserProfileRow;
    return {
      displayName: row.display_name,
      instructions: row.instructions,
      style: row.style,
      updatedAt: row.updated_at,
    };
  }

  upsert(input: UpsertUserProfileInput): UserProfile {
    this.database
      .prepare(
        `UPDATE user_profile
         SET display_name=?,instructions=?,style=?,updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
      )
      .run(
        input.displayName,
        input.instructions,
        input.style,
        GLOBAL_ENTITY_IDS.userProfile,
      );
    return this.get();
  }

  promptBlock(): string {
    const profile = this.get();
    const lines: string[] = [];
    if (profile.displayName)
      lines.push(`- Обращайся к пользователю: ${profile.displayName}`);
    if (profile.style) lines.push(`- Стиль общения: ${profile.style}`);
    if (profile.instructions)
      lines.push(`- Указания пользователя: ${profile.instructions}`);
    if (!lines.length) return "";
    return `\n\nПерсонализация ассистента (соблюдай на протяжении всего диалога):\n${lines.join("\n")}`;
  }
}
