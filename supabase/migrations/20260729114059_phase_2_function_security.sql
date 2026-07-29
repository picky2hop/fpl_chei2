revoke all on function public.replace_gameweek_scoring(uuid, integer, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function public.replace_gameweek_scoring(uuid, integer, jsonb, jsonb)
  to service_role;
