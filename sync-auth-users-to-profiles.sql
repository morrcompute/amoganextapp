-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR:
-- 1. Copies all existing auth.users into public.profiles table
-- 2. Sets up a trigger to automatically add any future registered user to profiles
-- ==============================================================================

-- 1. Sync all existing auth.users into public.profiles
INSERT INTO public.profiles (id, email, name, status, online, offline, updated_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', raw_user_meta_data->>'display_name', split_part(email, '@', 1)) AS name,
  'offline',
  false,
  true,
  now()
FROM auth.users
ON CONFLICT (id) DO UPDATE 
SET 
  email = EXCLUDED.email,
  name = COALESCE(public.profiles.name, EXCLUDED.name);

-- 2. Create the auto-sync function for future users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, status, online, offline, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'offline',
    false,
    true,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind the trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
