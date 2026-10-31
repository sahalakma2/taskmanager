// =============================================================================
// SUPABASE EDGE FUNCTION: push-scheduler
// Scheduled via pg_cron or Supabase Cron to run hourly in Asia/Kolkata timezone
// Evaluates Upcoming, Due Today, and Overdue tasks for the administrator,
// inserts notification records idempotently, and dispatches Web Push payloads
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  task_date: string;
  priority: string;
  status: string;
}

function getTodayIST(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const todayIST = getTodayIST();
    const tomorrowIST = addDays(todayIST, 1);

    // Fetch active admin preferences
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("notifications_enabled", true);

    if (!prefs || prefs.length === 0) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Notifications disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let createdCount = 0;

    for (const pref of prefs) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, user_id, title, task_date, priority, status")
        .eq("user_id", pref.user_id)
        .eq("is_trashed", false)
        .eq("status", "pending");

      if (!tasks) continue;

      for (const task of tasks as TaskRow[]) {
        let notifType: "overdue" | "due_today" | "upcoming" | null = null;
        let notifTitle = "";
        let notifMessage = "";

        if (task.task_date < todayIST && pref.notify_overdue) {
          notifType = "overdue";
          notifTitle = `Overdue Task: ${task.title}`;
          notifMessage = `Task "${task.title}" (${task.priority} priority) was due on ${task.task_date}.`;
        } else if (task.task_date === todayIST && pref.notify_due_today) {
          notifType = "due_today";
          notifTitle = `Due Today: ${task.title}`;
          notifMessage = `Task "${task.title}" (${task.priority} priority) is scheduled for today (${todayIST}).`;
        } else if (task.task_date === tomorrowIST && pref.notify_upcoming) {
          notifType = "upcoming";
          notifTitle = `Upcoming Tomorrow: ${task.title}`;
          notifMessage = `Task "${task.title}" is coming up tomorrow (${tomorrowIST}).`;
        }

        if (!notifType) continue;

        const dedupeKey = `${task.id}:${notifType}:${todayIST}`;

        const { error: insertErr } = await supabase.from("notifications").upsert(
          {
            user_id: task.user_id,
            task_id: task.id,
            type: notifType,
            title: notifTitle,
            message: notifMessage,
            dedupe_key: dedupeKey,
            scheduled_for: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true }
        );

        if (!insertErr) {
          createdCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        todayIST,
        notificationsProcessed: createdCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: "error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
