import { eq } from "drizzle-orm";
import type {
  BindingStore,
  LearningStore,
  SearchHSALBinding,
  SearchLearning,
} from "@talentos/hsal-adapter";
import { searchLearningSchema } from "@talentos/hsal-adapter";
import type { Db } from "@/lib/db/client";
import { hsalBindings, hsalSearchLearnings } from "@/lib/db/schema";

export class DrizzleBindingStore implements BindingStore {
  constructor(private readonly db: Db) {}
  async get(searchProjectId: string): Promise<SearchHSALBinding | undefined> {
    const [row] = await this.db
      .select()
      .from(hsalBindings)
      .where(eq(hsalBindings.searchProjectId, searchProjectId));
    return row
      ? {
          searchProjectId: row.searchProjectId,
          hsalDecisionCaseId: row.hsalDecisionCaseId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }
      : undefined;
  }
  async save(binding: SearchHSALBinding): Promise<void> {
    await this.db
      .insert(hsalBindings)
      .values(binding)
      .onConflictDoUpdate({
        target: hsalBindings.searchProjectId,
        set: {
          hsalDecisionCaseId: binding.hsalDecisionCaseId,
          updatedAt: binding.updatedAt,
        },
      });
  }
}

export class DrizzleLearningStore implements LearningStore {
  constructor(private readonly db: Db) {}
  private toLearning(
    row: typeof hsalSearchLearnings.$inferSelect,
  ): SearchLearning {
    return searchLearningSchema.parse({
      ...row,
      applicability: row.applicability,
    });
  }
  async save(learning: SearchLearning): Promise<void> {
    await this.db
      .insert(hsalSearchLearnings)
      .values({
        ...learning,
        applicability: learning.applicability as Record<string, string[]>,
      })
      .onConflictDoNothing();
  }
  async get(id: string): Promise<SearchLearning | undefined> {
    const [row] = await this.db
      .select()
      .from(hsalSearchLearnings)
      .where(eq(hsalSearchLearnings.id, id));
    return row ? this.toLearning(row) : undefined;
  }
  async list(): Promise<SearchLearning[]> {
    return (await this.db.select().from(hsalSearchLearnings)).map((r) =>
      this.toLearning(r),
    );
  }
}
