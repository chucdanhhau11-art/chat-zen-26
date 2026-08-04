CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_select ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY app_settings_admin_all ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
INSERT INTO public.app_settings (key, value) VALUES ('auto_approve_signup', 'false'::jsonb);
INSERT INTO public.user_roles (user_id, role) VALUES ('e14c540f-20da-4353-a66a-7703dcef14f3','admin')
  ON CONFLICT (user_id, role) DO NOTHING;