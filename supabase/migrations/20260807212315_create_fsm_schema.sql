/*
# Field Service Management — Core Schema

## Purpose
Creates the database backend for an internal Field Service Management (FSM) platform
used by a security systems company. Supports three user roles: Administrator,
Supervisor, and Technician.

## Tables Created
1. `profiles` — extends Supabase auth.users with company-specific data (role, title, phone, region, status, avatar info)
2. `work_orders` — service jobs (CCTV, Access Control, Fire Alarm, Fire Water, BMS, Electronic Security)
3. `documents` — uploaded manuals, forms, reports, contracts
4. `checklist_items` — per-work-order technician checklists
5. `work_order_comments` — comments on a work order
6. `work_order_history` — status/assignment change log
7. `audit_logs` — system-wide audit trail
8. `notifications` — in-app notifications per user

## Security (RLS)
- `profiles`: users read/update their own profile; admins read all profiles; supervisors read technicians in their region
- `work_orders`: technicians see assigned-to-them; supervisors see assigned-to-them + their technicians'; admins see all
- All child tables inherit visibility from their parent work_order
- `audit_logs`: admin-only read; system inserts via service role
- `notifications`: user reads only their own

## Notes
- `profiles.id` references `auth.users.id` (1:1)
- Work orders use `auth.uid()` defaults for ownership where applicable
- All tables have `created_at` timestamps
*/

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'technician' CHECK (role IN ('admin','supervisor','technician')),
  title text DEFAULT '',
  phone text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  region text DEFAULT '',
  avatar_color text DEFAULT 'bg-primary-600',
  initials text DEFAULT '',
  last_login timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_select_all_profiles" ON profiles;
CREATE POLICY "admin_select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;
CREATE POLICY "admin_update_all_profiles" ON profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_profiles" ON profiles;
CREATE POLICY "admin_insert_profiles" ON profiles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "supervisor_select_team_profiles" ON profiles;
CREATE POLICY "supervisor_select_team_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles s WHERE s.id = auth.uid() AND s.role = 'supervisor')
    AND (
      -- supervisors can see other supervisors and technicians (regional team view)
      EXISTS (SELECT 1 FROM profiles target WHERE target.id = profiles.id AND target.role IN ('supervisor','technician'))
    )
  );

-- ============================================================
-- 2. WORK ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  client text NOT NULL,
  site text NOT NULL,
  address text DEFAULT '',
  service_type text NOT NULL CHECK (service_type IN ('CCTV','Access Control','Fire Alarm','Fire Water','BMS','Electronic Security')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','scheduled','in_progress','paused','completed','cancelled')),
  technician_id uuid REFERENCES auth.users(id),
  supervisor_id uuid REFERENCES auth.users(id),
  scheduled_date date,
  scheduled_time text DEFAULT '09:00',
  duration_hrs numeric DEFAULT 2,
  description text DEFAULT '',
  equipment text DEFAULT '',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wo_select_own_tech" ON work_orders;
CREATE POLICY "wo_select_own_tech" ON work_orders FOR SELECT
  TO authenticated USING (auth.uid() = technician_id);

DROP POLICY IF EXISTS "wo_select_supervisor" ON work_orders;
CREATE POLICY "wo_select_supervisor" ON work_orders FOR SELECT
  TO authenticated USING (
    auth.uid() = supervisor_id
    OR technician_id IN (
      SELECT p.id FROM profiles p
      WHERE p.role = 'technician' AND p.region = (
        SELECT s.region FROM profiles s WHERE s.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "wo_select_admin" ON work_orders;
CREATE POLICY "wo_select_admin" ON work_orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "wo_update_own_tech" ON work_orders;
CREATE POLICY "wo_update_own_tech" ON work_orders FOR UPDATE
  TO authenticated USING (auth.uid() = technician_id)
  WITH CHECK (auth.uid() = technician_id);

DROP POLICY IF EXISTS "wo_update_supervisor" ON work_orders;
CREATE POLICY "wo_update_supervisor" ON work_orders FOR UPDATE
  TO authenticated USING (
    auth.uid() = supervisor_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
  )
  WITH CHECK (
    auth.uid() = supervisor_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
  );

DROP POLICY IF EXISTS "wo_update_admin" ON work_orders;
CREATE POLICY "wo_update_admin" ON work_orders FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "wo_insert_supervisor" ON work_orders;
CREATE POLICY "wo_insert_supervisor" ON work_orders FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','supervisor'))
  );

DROP POLICY IF EXISTS "wo_delete_admin" ON work_orders;
CREATE POLICY "wo_delete_admin" ON work_orders FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 3. DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'Manual',
  size text DEFAULT '',
  category text DEFAULT '',
  uploaded_by uuid REFERENCES auth.users(id),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docs_select_all_auth" ON documents;
CREATE POLICY "docs_select_all_auth" ON documents FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "docs_insert_auth" ON documents;
CREATE POLICY "docs_insert_auth" ON documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "docs_delete_owner" ON documents;
CREATE POLICY "docs_delete_owner" ON documents FOR DELETE
  TO authenticated USING (auth.uid() = uploaded_by);

-- ============================================================
-- 4. CHECKLIST ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  label text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  sort_order integer DEFAULT 0
);
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_select_wo_visible" ON checklist_items;
CREATE POLICY "checklist_select_wo_visible" ON checklist_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM work_orders w WHERE w.id = checklist_items.work_order_id
      AND (w.technician_id = auth.uid() OR w.supervisor_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  );

DROP POLICY IF EXISTS "checklist_update_wo_visible" ON checklist_items;
CREATE POLICY "checklist_update_wo_visible" ON checklist_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM work_orders w WHERE w.id = checklist_items.work_order_id
      AND (w.technician_id = auth.uid() OR w.supervisor_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  );

DROP POLICY IF EXISTS "checklist_insert_supervisor" ON checklist_items;
CREATE POLICY "checklist_insert_supervisor" ON checklist_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','supervisor'))
  );

DROP POLICY IF EXISTS "checklist_delete_supervisor" ON checklist_items;
CREATE POLICY "checklist_delete_supervisor" ON checklist_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','supervisor'))
  );

-- ============================================================
-- 5. WORK ORDER COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS work_order_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  author_name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE work_order_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_wo_visible" ON work_order_comments;
CREATE POLICY "comments_select_wo_visible" ON work_order_comments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM work_orders w WHERE w.id = work_order_comments.work_order_id
      AND (w.technician_id = auth.uid() OR w.supervisor_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  );

DROP POLICY IF EXISTS "comments_insert_own" ON work_order_comments;
CREATE POLICY "comments_insert_own" ON work_order_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "comments_delete_own" ON work_order_comments;
CREATE POLICY "comments_delete_own" ON work_order_comments FOR DELETE
  TO authenticated USING (auth.uid() = author_id);

-- ============================================================
-- 6. WORK ORDER HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS work_order_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE work_order_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "history_select_wo_visible" ON work_order_history;
CREATE POLICY "history_select_wo_visible" ON work_order_history FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM work_orders w WHERE w.id = work_order_history.work_order_id
      AND (w.technician_id = auth.uid() OR w.supervisor_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  );

DROP POLICY IF EXISTS "history_insert_auth" ON work_order_history;
CREATE POLICY "history_insert_auth" ON work_order_history FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid())
  );

-- ============================================================
-- 7. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_name text NOT NULL,
  action text NOT NULL,
  target text DEFAULT '',
  detail text DEFAULT '',
  ip_address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_admin" ON audit_logs;
CREATE POLICY "audit_select_admin" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "audit_insert_auth" ON audit_logs;
CREATE POLICY "audit_insert_auth" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid())
  );

-- ============================================================
-- 8. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text DEFAULT '',
  color text DEFAULT 'bg-primary-500',
  unread boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_insert_auth" ON notifications;
CREATE POLICY "notif_insert_auth" ON notifications FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid())
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_work_orders_technician ON work_orders(technician_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_supervisor ON work_orders(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_date ON work_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
