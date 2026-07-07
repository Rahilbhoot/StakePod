-- DROP EXISTING POLICIES THAT CAUSE RECURSION
DROP POLICY IF EXISTS "Users can view pods they are members of" ON public.pods;
DROP POLICY IF EXISTS "Users can view pod_members of their pods" ON public.pod_members;
DROP POLICY IF EXISTS "Users can view check_ins of their pods" ON public.check_ins;
DROP POLICY IF EXISTS "Users can view ledger of their pods" ON public.ledger;

-- CREATE SECURITY DEFINER FUNCTION TO BREAK RECURSION
CREATE OR REPLACE FUNCTION public.get_user_pods(user_uuid UUID)
RETURNS TABLE(pod_id UUID) SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT pm.pod_id FROM public.pod_members pm WHERE pm.user_id = user_uuid
  UNION
  SELECT p.id FROM public.pods p WHERE p.created_by = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- RECREATE POLICIES USING THE FUNCTION
CREATE POLICY "Users can view pods they are members of" ON public.pods FOR SELECT 
USING (
  created_by = auth.uid() OR 
  id IN (SELECT public.get_user_pods(auth.uid()))
);

CREATE POLICY "Users can view pod_members of their pods" ON public.pod_members FOR SELECT 
USING (
  user_id = auth.uid() OR
  pod_id IN (SELECT public.get_user_pods(auth.uid()))
);

CREATE POLICY "Users can view check_ins of their pods" ON public.check_ins FOR SELECT 
USING (
  pod_id IN (SELECT public.get_user_pods(auth.uid()))
);

CREATE POLICY "Users can view ledger of their pods" ON public.ledger FOR SELECT 
USING (
  pod_id IN (SELECT public.get_user_pods(auth.uid()))
);
