-- mapollo: multi-list support
alter table public.contacts add column if not exists lists text[] not null default '{}';

-- backfill existing single list_name into the lists array
update public.contacts set lists = array[list_name]
  where list_name is not null and list_name <> '' and (lists is null or lists = '{}');

create index if not exists contacts_lists_gin on public.contacts using gin (lists);

-- append selected contacts to a list (union, never removes existing memberships)
create or replace function public.add_to_list(p_ids uuid[], p_list text)
returns integer language sql security invoker as $$
  with upd as (
    update public.contacts
    set lists = (
          select array(
            select distinct e
            from unnest(coalesce(contacts.lists, '{}') || array[p_list]) as e
            where e is not null and e <> ''
          )
        ),
        list_name = case when list_name is null or list_name = '' then p_list else list_name end
    where id = any(p_ids)
    returning 1
  )
  select count(*)::int from upd;
$$;

grant execute on function public.add_to_list(uuid[], text) to authenticated;
