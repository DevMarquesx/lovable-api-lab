CREATE OR REPLACE FUNCTION public.can_access_idoso(_idoso_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenacao')
    OR public.has_role(auth.uid(), 'profissional_cras')
    OR EXISTS (SELECT 1 FROM public.idosos i WHERE i.id = _idoso_id AND i.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.vinculos v WHERE v.idoso_id = _idoso_id AND v.responsavel_id = auth.uid() AND v.ativo);
$$;