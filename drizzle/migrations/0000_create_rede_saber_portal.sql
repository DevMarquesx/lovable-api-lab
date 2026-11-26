CREATE TYPE public.app_role AS ENUM ('admin', 'coordenacao', 'escola', 'idoso', 'familiar', 'profissional_cras');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

CREATE POLICY "profiles_read_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_read_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.escola_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  co_entidade TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, co_entidade)
);
GRANT SELECT ON public.escola_usuarios TO authenticated;
GRANT ALL ON public.escola_usuarios TO service_role;
ALTER TABLE public.escola_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escola_usuarios_read_own_or_manager" ON public.escola_usuarios FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao'));

CREATE TABLE public.idosos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  cpf_hash TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  municipio_codigo TEXT NOT NULL CHECK (municipio_codigo ~ '^[0-9]{7}$'),
  saberes TEXT[] NOT NULL DEFAULT '{}',
  horarios TEXT[] NOT NULL DEFAULT '{}',
  distancia_max_km NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (distancia_max_km BETWEEN 0 AND 50),
  ativo BOOLEAN NOT NULL DEFAULT true,
  cadastrado_por UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.idosos TO authenticated;
GRANT ALL ON public.idosos TO service_role;
ALTER TABLE public.idosos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idoso_id UUID NOT NULL REFERENCES public.idosos(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('filho', 'neto', 'cuidador', 'outro')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  revogado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vinculo_ativo_unico ON public.vinculos (idoso_id, responsavel_id) WHERE ativo;
GRANT SELECT, INSERT, UPDATE ON public.vinculos TO authenticated;
GRANT ALL ON public.vinculos TO service_role;
ALTER TABLE public.vinculos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_idoso(_idoso_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'profissional_cras')
    OR EXISTS (SELECT 1 FROM public.idosos i WHERE i.id = _idoso_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.vinculos v WHERE v.idoso_id = _idoso_id AND v.responsavel_id = auth.uid() AND v.ativo);
$$;
REVOKE ALL ON FUNCTION public.can_access_idoso(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_idoso(UUID) TO authenticated, service_role;

CREATE POLICY "idosos_read_allowed" ON public.idosos FOR SELECT TO authenticated USING (public.can_access_idoso(id));
CREATE POLICY "idosos_insert_allowed" ON public.idosos FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'profissional_cras')
);
CREATE POLICY "idosos_update_allowed" ON public.idosos FOR UPDATE TO authenticated
  USING (public.can_access_idoso(id)) WITH CHECK (public.can_access_idoso(id));
CREATE POLICY "vinculos_read_allowed" ON public.vinculos FOR SELECT TO authenticated
  USING (responsavel_id = auth.uid() OR public.can_access_idoso(idoso_id));
CREATE POLICY "vinculos_insert_allowed" ON public.vinculos FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'profissional_cras')
  OR EXISTS (SELECT 1 FROM public.idosos i WHERE i.id = idoso_id AND i.user_id = auth.uid())
);
CREATE POLICY "vinculos_update_allowed" ON public.vinculos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.idosos i WHERE i.id = idoso_id AND i.user_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.idosos i WHERE i.id = idoso_id AND i.user_id = auth.uid()));

CREATE TABLE public.consentimentos_saude (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idoso_id UUID NOT NULL UNIQUE REFERENCES public.idosos(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  provision_type TEXT NOT NULL CHECK (provision_type IN ('permit', 'deny')),
  inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fim TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.consentimentos_saude TO authenticated;
GRANT ALL ON public.consentimentos_saude TO service_role;
ALTER TABLE public.consentimentos_saude ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consentimento_read_allowed" ON public.consentimentos_saude FOR SELECT TO authenticated USING (public.can_access_idoso(idoso_id));
CREATE POLICY "consentimento_write_self_or_admin" ON public.consentimentos_saude FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.idosos i WHERE i.id = idoso_id AND i.user_id = auth.uid())
);
CREATE POLICY "consentimento_update_self_or_admin" ON public.consentimentos_saude FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.idosos i WHERE i.id = idoso_id AND i.user_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.idosos i WHERE i.id = idoso_id AND i.user_id = auth.uid()));

CREATE TABLE public.certidoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idoso_id UUID NOT NULL UNIQUE REFERENCES public.idosos(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('aprovado', 'pendente', 'reprovado')),
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  validade DATE,
  solicitado_por UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.certidoes TO authenticated;
GRANT ALL ON public.certidoes TO service_role;
ALTER TABLE public.certidoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certidao_read_allowed" ON public.certidoes FOR SELECT TO authenticated USING (public.can_access_idoso(idoso_id));
CREATE POLICY "certidao_insert_self_or_admin" ON public.certidoes FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'profissional_cras')
  OR EXISTS (SELECT 1 FROM public.idosos i WHERE i.id = idoso_id AND i.user_id = auth.uid())
);

CREATE TABLE public.criancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  co_entidade TEXT NOT NULL,
  cadastrado_por UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.criancas TO authenticated;
GRANT ALL ON public.criancas TO service_role;
ALTER TABLE public.criancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "criancas_read_manager_or_school" ON public.criancas FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao')
  OR EXISTS (SELECT 1 FROM public.escola_usuarios eu WHERE eu.user_id = auth.uid() AND eu.co_entidade = criancas.co_entidade AND eu.ativo)
);
CREATE POLICY "criancas_insert_manager" ON public.criancas FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao')
);

CREATE TABLE public.autorizacoes_criancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crianca_id UUID NOT NULL REFERENCES public.criancas(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  ativo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (crianca_id, responsavel_id)
);
GRANT SELECT, INSERT ON public.autorizacoes_criancas TO authenticated;
GRANT ALL ON public.autorizacoes_criancas TO service_role;
ALTER TABLE public.autorizacoes_criancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autorizacao_read_allowed" ON public.autorizacoes_criancas FOR SELECT TO authenticated USING (
  responsavel_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao')
);
CREATE POLICY "autorizacao_insert_manager" ON public.autorizacoes_criancas FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao')
);

CREATE TABLE public.pedidos_escola (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  co_entidade TEXT NOT NULL,
  tema TEXT NOT NULL,
  turma TEXT,
  periodo TEXT NOT NULL CHECK (periodo IN ('manha', 'tarde', 'noite')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  motivo_decisao TEXT,
  criado_por UUID NOT NULL REFERENCES public.profiles(id),
  decidido_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pedidos_escola TO authenticated;
GRANT ALL ON public.pedidos_escola TO service_role;
ALTER TABLE public.pedidos_escola ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_pedido(_pedido_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao')
    OR EXISTS (SELECT 1 FROM public.pedidos_escola p JOIN public.escola_usuarios eu ON eu.co_entidade = p.co_entidade
      WHERE p.id = _pedido_id AND eu.user_id = auth.uid() AND eu.ativo);
$$;
REVOKE ALL ON FUNCTION public.can_access_pedido(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_pedido(UUID) TO authenticated, service_role;

CREATE POLICY "pedidos_read_allowed" ON public.pedidos_escola FOR SELECT TO authenticated USING (public.can_access_pedido(id));
CREATE POLICY "pedidos_insert_school_or_admin" ON public.pedidos_escola FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR (
    public.has_role(auth.uid(), 'escola') AND EXISTS (
      SELECT 1 FROM public.escola_usuarios eu WHERE eu.user_id = auth.uid() AND eu.co_entidade = pedidos_escola.co_entidade AND eu.ativo
    )
  )
);
CREATE POLICY "pedidos_update_manager" ON public.pedidos_escola FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao'));

CREATE TABLE public.pareamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos_escola(id) ON DELETE CASCADE,
  idoso_id UUID NOT NULL REFERENCES public.idosos(id) ON DELETE CASCADE,
  chance_continuidade NUMERIC(5,2) NOT NULL CHECK (chance_continuidade BETWEEN 0 AND 100),
  distancia_km NUMERIC(8,2),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  motivo_decisao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pedido_id, idoso_id)
);
GRANT SELECT, INSERT, UPDATE ON public.pareamentos TO authenticated;
GRANT ALL ON public.pareamentos TO service_role;
ALTER TABLE public.pareamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pareamentos_read_allowed" ON public.pareamentos FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao') OR public.can_access_idoso(idoso_id) OR public.can_access_pedido(pedido_id)
);
CREATE POLICY "pareamentos_insert_manager" ON public.pareamentos FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao')
);
CREATE POLICY "pareamentos_update_manager" ON public.pareamentos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao'));

CREATE TABLE public.encontros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pareamento_id UUID NOT NULL REFERENCES public.pareamentos(id) ON DELETE CASCADE,
  crianca_id UUID NOT NULL REFERENCES public.criancas(id),
  data TIMESTAMPTZ NOT NULL,
  local TEXT NOT NULL CHECK (local IN ('escola', 'cras', 'biblioteca')),
  criado_por UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.encontros TO authenticated;
GRANT ALL ON public.encontros TO service_role;
ALTER TABLE public.encontros ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_encontro(_encontro_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao')
    OR EXISTS (SELECT 1 FROM public.encontros e JOIN public.pareamentos pa ON pa.id = e.pareamento_id
      WHERE e.id = _encontro_id AND (public.can_access_idoso(pa.idoso_id) OR public.can_access_pedido(pa.pedido_id)));
$$;
REVOKE ALL ON FUNCTION public.can_access_encontro(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_encontro(UUID) TO authenticated, service_role;

CREATE POLICY "encontros_read_allowed" ON public.encontros FOR SELECT TO authenticated USING (public.can_access_encontro(id));
CREATE POLICY "encontros_insert_manager" ON public.encontros FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao')
);

CREATE TABLE public.presencas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id UUID NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL,
  presente BOOLEAN NOT NULL,
  registrado_por UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (encontro_id, pessoa_id)
);
GRANT SELECT, INSERT ON public.presencas TO authenticated;
GRANT ALL ON public.presencas TO service_role;
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presencas_read_allowed" ON public.presencas FOR SELECT TO authenticated USING (public.can_access_encontro(encontro_id));
CREATE POLICY "presencas_insert_manager" ON public.presencas FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao')
);

CREATE TABLE public.auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  detalhes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auditoria_read_admin" ON public.auditoria FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "auditoria_insert_own" ON public.auditoria FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome) VALUES (NEW.id, LEFT(COALESCE(NEW.raw_user_meta_data ->> 'nome', ''), 160))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Nao foi possivel criar o perfil inicial do usuario %', NEW.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();