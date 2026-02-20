CREATE POLICY "public_read_usuarios_online"
ON public.usuarios_online
FOR SELECT
USING (true);