UPDATE public.profiles SET username = split_part(username, '@', 1) WHERE username LIKE '%@%';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    split_part(COALESCE(NULLIF(NEW.raw_user_meta_data->>'username',''), NEW.email), '@', 1),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;