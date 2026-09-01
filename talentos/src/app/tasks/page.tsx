import { getDb } from "@/lib/db/client";
import { listOpenTasks } from "@/lib/services/workflow";
import { CompleteTaskButton, TaskForm } from "@/components/task-controls";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const tasks = await listOpenTasks(getDb());
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Tasks"
        description="Free-standing to-dos alongside the per-search next-best-action queue."
      />
      <div className="space-y-4">
        <Card>
          <TaskForm />
        </Card>
        <Card title={`Open (${tasks.length})`}>
          {tasks.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Nothing open.</p>
          ) : (
            <ul className="divide-y divide-edge">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{task.title}</span>
                    {task.dueAt && (
                      <span
                        className={`text-[11.5px] ${
                          task.dueAt <= new Date().toISOString()
                            ? "text-bad"
                            : "text-ink-faint"
                        }`}
                      >
                        due {new Date(task.dueAt).toLocaleDateString()}
                      </span>
                    )}
                  </span>
                  <CompleteTaskButton taskId={task.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
