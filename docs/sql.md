Studio(SQL Editor) で情報を抽出                                                  
                                                                                 
- テーブル一覧:                                                                  
select table_schema, table_name from information_schema.tables where       
table_schema='public' and table_type='BASE TABLE' order by 1,2;                  
- カラム定義:                                                                    
select table_name, ordinal_position, column_name, data_type, is_nullable,  
column_default from information_schema.columns where table_schema='public' order 
by table_name, ordinal_position;                                                 
- RLSの有効化状況:                                                               
select n.nspname schema, c.relname table, c.relrowsecurity as rls_enabled, 
c.relforcerowsecurity as force_rls from pg_class c join pg_namespace n on        
n.oid=c.relnamespace where c.relkind='r' and n.nspname='public' order by 1,2;    
- ポリシー一覧（条件含む）:                                                      
select schemaname, tablename, policyname, permissive, roles, cmd, qual,    
with_check from pg_policies where schemaname='public' order by 2,3;              
- ポリシーをDDL風に再構成（参考出力）:                                           
select format('create policy %I on %I.%I for %s to %s using (%s)%s;',      
policyname, schemaname, tablename, cmd, array_to_string(roles, ', '),            
coalesce(qual,'true'), case when with_check is not null then format(' with check 
(%s)', with_check) else '' end) as create_policy_sql from pg_policies where      
schemaname='public' order by tablename, policyname;                              
- 関数の定義（RLSヘルパーなど）:                                                 
select n.nspname as schema, p.proname, pg_get_functiondef(p.oid)           
as ddl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where          
n.nspname='public' and p.proname in ('viewer_is_admin','viewer_department') order
by 1,2;  