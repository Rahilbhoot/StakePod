-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PODS TABLE
CREATE TABLE public.pods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  stake_amount DECIMAL NOT NULL,
  currency TEXT DEFAULT 'INR',
  frequency TEXT NOT NULL,
  check_in_window_start TIME NOT NULL,
  check_in_window_end TIME NOT NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  total_check_ins INTEGER NOT NULL,
  free_strikes INTEGER DEFAULT 2,
  failure_threshold_pct INTEGER DEFAULT 50,
  split_type TEXT DEFAULT 'equal',
  status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES public.users(id) NOT NULL,
  invite_code TEXT UNIQUE NOT NULL
);


-- POD_MEMBERS TABLE
CREATE TABLE public.pod_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  stake_paid BOOLEAN DEFAULT FALSE,
  stake_status TEXT DEFAULT 'pending',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pod_id, user_id)
);

-- CHECK_INS TABLE
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  note TEXT,
  photo_url TEXT,
  checked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(pod_id, user_id, date)
);

-- LEDGER TABLE
CREATE TABLE public.ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- stake/forfeit/payout
  amount DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- SECURITY DEFINER FUNCTION TO BREAK RECURSION IN POLICIES
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

-- Pods: A user can only see pods they are a member of (or created)
CREATE POLICY "Users can view pods they are members of" ON public.pods FOR SELECT 
USING (
  created_by = auth.uid() OR 
  id IN (SELECT public.get_user_pods(auth.uid()))
);
CREATE POLICY "Users can create pods" ON public.pods FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creators can update pods" ON public.pods FOR UPDATE USING (created_by = auth.uid());

-- Pod Members: A user can only see pod_members for pods they belong to
CREATE POLICY "Users can view pod_members of their pods" ON public.pod_members FOR SELECT 
USING (
  user_id = auth.uid() OR
  pod_id IN (SELECT public.get_user_pods(auth.uid()))
);
CREATE POLICY "Users can insert themselves into pod_members" ON public.pod_members FOR INSERT WITH CHECK (user_id = auth.uid());

-- Check-ins: A user can only see check_ins for pods they belong to
CREATE POLICY "Users can view check_ins of their pods" ON public.check_ins FOR SELECT 
USING (
  pod_id IN (SELECT public.get_user_pods(auth.uid()))
);
CREATE POLICY "Users can insert own check_ins" ON public.check_ins FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own check_ins" ON public.check_ins FOR UPDATE USING (user_id = auth.uid());

-- Ledger: A user can only see ledger rows for pods they belong to
CREATE POLICY "Users can view ledger of their pods" ON public.ledger FOR SELECT 
USING (
  pod_id IN (SELECT public.get_user_pods(auth.uid()))
);


-- TRIGGER FOR NEW USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
