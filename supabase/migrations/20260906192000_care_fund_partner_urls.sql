-- Additive only. Does not drop pets, reports, or Gina.

alter table if exists organizations add column if not exists paypal_me text;
alter table if exists organizations add column if not exists venmo_handle text;
alter table if exists organizations add column if not exists donate_url text;

alter table if exists care_funds add column if not exists location text;
alter table if exists care_funds add column if not exists donate_url text;
alter table if exists care_funds add column if not exists incident_key text;

create unique index if not exists care_funds_incident_key_uidx on care_funds (incident_key) where incident_key is not null;

insert into care_funds (name, description, goal_amount, raised_amount, active, location, donate_url, incident_key)
values
  ('ASPCA — national rescue & cruelty response', 'Official ASPCA donate page. Rescue Army does not collect gifts.', 0, 0, true, 'United States', 'https://secure.aspca.org/donate/donate', 'aspca-campaign'),
  ('PETA — investigations & rescue fund', 'Official PETA donate form. Rescue Army does not collect gifts.', 0, 0, true, 'United States', 'https://support.peta.org/page/73414/donate/1?locale=en-US', 'peta-campaign'),
  ('Humane World for Animals (formerly HSUS)', 'Official ways-to-give. Local humane societies are separate.', 0, 0, true, 'Worldwide', 'https://www.humaneworld.org/en/ways-to-give', 'humane-world-campaign'),
  ('Nepal Flood Tragedy 2026', 'Opens the partner PayPal/Venmo when connected. Rescue Army never holds the money.', 25000, 0, true, 'Nepal', null, 'nepal-flood-2026')
on conflict (incident_key) do nothing;
