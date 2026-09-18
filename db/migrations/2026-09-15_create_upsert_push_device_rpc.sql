BEGIN;

-- 1) Create `push_devices` table
CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  fcm_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android','ios')),
  device_id text NULL,
  app_version text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Foreign keys based on existing FleetOS schema
-- There are references to `profiles` and `companies` throughout the codebase
-- (examples: many server routes call `.from("profiles")` and `.from("companies")`).
ALTER TABLE public.push_devices
  ADD CONSTRAINT fk_push_devices_user_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.push_devices
  ADD CONSTRAINT fk_push_devices_company_companies FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3) Uniqueness and indexes
ALTER TABLE public.push_devices
  ADD CONSTRAINT push_devices_fcm_token_unique UNIQUE (fcm_token);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_id ON public.push_devices (user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_company_id ON public.push_devices (company_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_active ON public.push_devices (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_devices_user_active ON public.push_devices (user_id) WHERE is_active = true;

-- 4) Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION public._set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_devices_set_updated_at ON public.push_devices;
CREATE TRIGGER trg_push_devices_set_updated_at
BEFORE UPDATE ON public.push_devices
FOR EACH ROW
EXECUTE FUNCTION public._set_updated_at();

-- 5) Enable Row Level Security
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

-- 6) RLS policies: allow each authenticated user to manage only their own rows
-- SELECT: users can read only their own device rows
CREATE POLICY push_devices_select_own ON public.push_devices
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- INSERT: require that inserted rows belong to the authenticated user and their company
CREATE POLICY push_devices_insert_own ON public.push_devices
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: allow updates only to the owner's rows and prevent changing owner/company to another
CREATE POLICY push_devices_update_own ON public.push_devices
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- DELETE: allow only the owner to delete their rows
CREATE POLICY push_devices_delete_own ON public.push_devices
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- 7) Secure upsert RPC
CREATE OR REPLACE FUNCTION public.upsert_push_device(
  p_fcm_token text,
  p_platform text,
  p_device_id text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_is_active boolean DEFAULT true
) RETURNS public.push_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_company_id uuid;
  v_existing_id uuid;
  v_row public.push_devices%ROWTYPE;
BEGIN
  -- Use a safe search_path so SECURITY DEFINER privileges can't be abused

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Resolve the caller's company server-side; client must not supply company
  SELECT company_id INTO v_company_id FROM public.profiles WHERE id = v_uid LIMIT 1;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'profile_missing_company';
  END IF;

  IF p_fcm_token IS NULL OR btrim(p_fcm_token) = '' THEN
    RAISE EXCEPTION 'invalid_fcm_token';
  END IF;

  IF lower(p_platform) NOT IN ('android','ios') THEN
    RAISE EXCEPTION 'invalid_platform';
  END IF;

  -- Try to find an existing row for this token and lock it to avoid races
  SELECT id INTO v_existing_id
    FROM public.push_devices
   WHERE fcm_token = p_fcm_token
   FOR UPDATE
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Transfer/update the existing token row to the current user/company atomically
    UPDATE public.push_devices
       SET user_id = v_uid,
           company_id = v_company_id,
           platform = lower(p_platform),
           device_id = p_device_id,
           app_version = p_app_version,
           metadata = COALESCE(p_metadata, metadata),
           is_active = p_is_active,
           last_seen_at = now(),
           updated_at = now()
     WHERE id = v_existing_id
     RETURNING * INTO v_row;

    RETURN v_row;
  ELSE
    -- Insert new row for this user's token
    INSERT INTO public.push_devices (
      company_id, user_id, fcm_token, platform, device_id, app_version, metadata, is_active, last_seen_at
    ) VALUES (
      v_company_id, v_uid, p_fcm_token, lower(p_platform), p_device_id, p_app_version, COALESCE(p_metadata, '{}'::jsonb), p_is_active, now()
    ) RETURNING * INTO v_row;

    RETURN v_row;
  END IF;
END;
$$;

-- 8) Restrict who may execute the RPC: remove PUBLIC then grant to `authenticated` only
REVOKE ALL ON FUNCTION public.upsert_push_device(text, text, text, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_push_device(text, text, text, text, jsonb, boolean) TO authenticated;

COMMIT;
