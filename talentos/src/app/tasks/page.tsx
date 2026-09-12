import { getDb } from "@/lib/db/client";
import { listTasks } from "@/lib/services/workflow";
import { TaskForm } from "@/components/task-controls";
import { TaskList } from "@/components/task-list";
import { OpenAsPane } from "@/components/open-as-pane";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const tasks = await listTasks(getDb());
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="✅ Tasks"
        description="Free-standing to-dos, in the order you want to do them. Drag one, or use the arrows. Tick one and it stays where it is, struck through, so you can see what you got through — and untick it if you were wrong."
        actions={<OpenAsPane target="tasks" />}
      />
      <div className="space-y-4">
        <Card>
          <TaskForm />
        </Card>
        <Card title={`✅ ${tasks.open} open · ${tasks.done} done`}>
          <TaskList
            olderDone={tasks.olderDone}
            tasks={tasks.rows.map((task) => ({
              id: task.id,
              title: task.title,
              dueAt: task.dueAt,
              searchProjectId: task.searchProjectId,
              done: task.status === "done",
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
