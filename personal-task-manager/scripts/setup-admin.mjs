// =============================================================================
// INITIAL ADMINISTRATOR PROVISIONING SCRIPT (SERVER-SIDE ONLY)
// Run once with Node.js >= 18 using your SUPABASE_SERVICE_ROLE_KEY
// NEVER expose SUPABASE_SERVICE_ROLE_KEY in frontend code!
//
// Usage:
//   SUPABASE_URL="https://xyz.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
//   ADMIN_USERNAME="admin" \
//   ADMIN_EMAIL="admin@yourdomain.com" \
//   ADMIN_PASSWORD="ChangeMeImmediately!2026" \
//   node scripts/setup-admin.mjs
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@taskvault.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_PASSWORD) {
  console.error(
    "Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD"
  );
  process.exit(1);
}

async function provisionAdmin() {
  console.log(`Provisioning single administrator account (${ADMIN_USERNAME})...`);

  // 1. Create confirmed user in Supabase Auth via Admin API
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: ADMIN_USERNAME,
        role: "admin",
      },
    }),
  });

  if (!authRes.ok) {
    const errText = await authRes.text();
    throw new Error(`Failed to create auth user: ${errText}`);
  }

  const authUser = await authRes.json();
  const userId = authUser.id;
  console.log(`Created Supabase Auth user ID: ${userId}`);

  // 2. Insert profile row mapping username -> email
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: userId,
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      full_name: "System Administrator",
      role: "admin",
      is_active: true,
    }),
  });

  if (!profileRes.ok) {
    throw new Error(`Failed to create profile: ${await profileRes.text()}`);
  }

  // 3. Seed default preferences (Asia/Kolkata timezone)
  await fetch(`${SUPABASE_URL}/rest/v1/user_preferences`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      user_id: userId,
      custom_dashboard_heading: "",
      theme: "light",
      default_task_view: "grid",
      timezone: "Asia/Kolkata",
      notifications_enabled: true,
    }),
  });

  // 4. Seed default categories
  const defaultCategories = [
    { name: "Work", color: "#2563EB", icon: "Briefcase", is_default: true, sort_order: 1 },
    { name: "Personal", color: "#059669", icon: "User", is_default: true, sort_order: 2 },
    { name: "Content Creation", color: "#7C3AED", icon: "Video", is_default: true, sort_order: 3 },
    { name: "Business", color: "#D97706", icon: "TrendingUp", is_default: true, sort_order: 4 },
    { name: "Meetings", color: "#0891B2", icon: "Users", is_default: true, sort_order: 5 },
    { name: "Other", color: "#64748B", icon: "Folder", is_default: true, sort_order: 6 },
  ].map((c) => ({ ...c, user_id: userId }));

  await fetch(`${SUPABASE_URL}/rest/v1/categories`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify(defaultCategories),
  });

  console.log("Administrator provisioning complete! Public signup remains disabled.");
}

provisionAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
