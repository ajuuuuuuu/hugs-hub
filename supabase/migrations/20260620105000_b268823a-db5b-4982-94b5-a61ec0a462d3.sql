
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PERSONS ============
CREATE TABLE public.persons (
  id text PRIMARY KEY,
  name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male','female','other')),
  birth_date date,
  death_date date,
  photo_url text,
  biography text,
  family_group text NOT NULL DEFAULT 'hawthorne',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.persons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.persons TO authenticated;
GRANT ALL ON public.persons TO service_role;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read persons" ON public.persons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write persons" ON public.persons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ RELATIONSHIPS ============
CREATE TABLE public.relationships (
  id text PRIMARY KEY,
  person1_id text NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  person2_id text NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('parent','spouse')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.relationships TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.relationships TO authenticated;
GRANT ALL ON public.relationships TO service_role;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read relationships" ON public.relationships FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write relationships" ON public.relationships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  person_id text REFERENCES public.persons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users update own name" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND person_id IS NOT DISTINCT FROM (SELECT person_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ JOIN REQUESTS ============
CREATE TABLE public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_person_id text NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  relation text NOT NULL CHECK (relation IN ('son','daughter')),
  proposed_name text NOT NULL,
  proposed_gender text NOT NULL CHECK (proposed_gender IN ('male','female','other')),
  proposed_birth_date date,
  proposed_photo_url text,
  proposed_biography text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT, INSERT ON public.join_requests TO authenticated;
GRANT UPDATE ON public.join_requests TO authenticated;
GRANT ALL ON public.join_requests TO service_role;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user read own requests" ON public.join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user create own request" ON public.join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "admin update requests" ON public.join_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SEED PERSONS ============
INSERT INTO public.persons (id, name, gender, birth_date, death_date, biography, family_group) VALUES
('p1','Arthur Hawthorne','male','1920-03-12','1995-08-04','Patriarch of the Hawthorne family. Carpenter and storyteller.','hawthorne'),
('p2','Eleanor Hawthorne','female','1923-07-22','2001-01-15','Matriarch. Schoolteacher for 40 years.','hawthorne'),
('p3','Robert Hawthorne','male','1948-11-02',NULL,'Eldest son. Civil engineer.','hawthorne'),
('p4','Margaret Hawthorne','female','1950-05-19',NULL,'Daughter-in-law. Painter. Born into the Blake family.','blake'),
('p5','Susan Hawthorne','female','1952-09-30',NULL,'Daughter. Doctor.','hawthorne'),
('p6','James Hawthorne','male','1975-02-14',NULL,'Son of Robert and Margaret. Software engineer.','hawthorne'),
('p7','Linda Hawthorne','female','1977-06-08',NULL,'James''s wife. Architect. Born into the Chen family.','chen'),
('p8','Emily Hawthorne','female','1978-10-21',NULL,'Daughter of Robert and Margaret. Journalist.','hawthorne'),
('p9','Oliver Hawthorne','male','2005-04-11',NULL,'Son of James and Linda.','hawthorne'),
('p10','Sophia Hawthorne','female','2008-12-03',NULL,'Daughter of James and Linda.','hawthorne'),
('b1','Henry Blake','male','1898-01-15','1972-04-20','Margaret''s grandfather. Farmer.','blake'),
('b2','Alice Blake','female','1902-09-08','1980-11-30','Margaret''s grandmother.','blake'),
('b3','Thomas Blake','male','1925-06-12','1998-02-14','Margaret''s father. Engineer.','blake'),
('b4','Dorothy Blake','female','1928-03-22','2005-07-18','Margaret''s mother. Librarian.','blake'),
('b5','Peter Blake','male','1953-08-05',NULL,'Margaret''s younger brother.','blake'),
('c1','Wei Chen','male','1920-11-03','1995-05-09','Linda''s grandfather. Merchant.','chen'),
('c2','Mei Chen','female','1924-02-18','2002-10-22','Linda''s grandmother.','chen'),
('c3','David Chen','male','1950-04-27',NULL,'Linda''s father. Professor.','chen'),
('c4','Helen Chen','female','1952-12-11',NULL,'Linda''s mother. Pianist.','chen'),
('c5','Grace Chen','female','1980-05-14',NULL,'Linda''s younger sister.','chen');

INSERT INTO public.relationships (id, person1_id, person2_id, type) VALUES
('r1','p1','p2','spouse'),('r2','p1','p3','parent'),('r3','p2','p3','parent'),
('r4','p1','p5','parent'),('r5','p2','p5','parent'),('r6','p3','p4','spouse'),
('r7','p3','p6','parent'),('r8','p4','p6','parent'),('r9','p3','p8','parent'),
('r10','p4','p8','parent'),('r11','p6','p7','spouse'),('r12','p6','p9','parent'),
('r13','p7','p9','parent'),('r14','p6','p10','parent'),('r15','p7','p10','parent'),
('rb1','b1','b2','spouse'),('rb2','b1','b3','parent'),('rb3','b2','b3','parent'),
('rb4','b3','b4','spouse'),('rb5','b3','p4','parent'),('rb6','b4','p4','parent'),
('rb7','b3','b5','parent'),('rb8','b4','b5','parent'),
('rc1','c1','c2','spouse'),('rc2','c1','c3','parent'),('rc3','c2','c3','parent'),
('rc4','c3','c4','spouse'),('rc5','c3','p7','parent'),('rc6','c4','p7','parent'),
('rc7','c3','c5','parent'),('rc8','c4','c5','parent');
