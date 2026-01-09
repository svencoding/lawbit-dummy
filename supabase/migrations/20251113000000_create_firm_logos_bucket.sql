-- Create storage bucket for firm logos
insert into storage.buckets (id, name, public)
values ('firm-logos', 'firm-logos', true)
on conflict (id) do nothing;

-- Set up storage policies for firm logos
create policy "Users can upload their own firm logo"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'firm-logos' AND
  (storage.foldername(name))[1] = 'logos'
);

create policy "Anyone can view firm logos"
on storage.objects
for select
to public
using (bucket_id = 'firm-logos');

create policy "Users can update their own firm logo"
on storage.objects
for update
to authenticated
using (bucket_id = 'firm-logos')
with check (bucket_id = 'firm-logos');

create policy "Users can delete their own firm logo"
on storage.objects
for delete
to authenticated
using (bucket_id = 'firm-logos');

