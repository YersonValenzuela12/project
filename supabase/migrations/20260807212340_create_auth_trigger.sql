/*
# Auto-create profile on signup + admin bootstrap

## Purpose
1. Creates a trigger function `handle_new_user()` that automatically inserts a row
   into `profiles` whenever a new user registers via Supabase Auth.
2. Attaches the trigger to `auth.users` after insert.
3. Grants the trigger function security definer access so it can write to profiles.

## How it works
- When `auth.users` gets a new row (sign-up), the trigger fires.
- It extracts email from the new user and creates a matching `profiles` row.
- Default role is 'technician', default status is 'active'.
- The admin can later promote the user via the Users page.

## Security
- The function runs as SECURITY DEFINER with the service role, so it bypasses RLS
  to insert the profile row. This is the standard Supabase pattern.
- search_path is locked to 'public' to prevent schema injection.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, title, status, initials, avatar_color)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'technician'),
    COALESCE(NEW.raw_user_meta_data->>'title', ''),
    'active',
    COALESCE(NEW.raw_user_meta_data->>'initials', UPPER(LEFT(split_part(NEW.email, '@', 1), 2))),
    COALESCE(NEW.raw_user_meta_data->>'avatar_color', 'bg-primary-600')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
