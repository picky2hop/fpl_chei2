-- Allow authenticated users to invoke the deadline check used by predictions RLS.
grant execute on function private.can_write_prediction(uuid) to authenticated;
