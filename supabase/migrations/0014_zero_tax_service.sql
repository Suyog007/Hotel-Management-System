-- Room-rate-only pricing: the hotel charges the nightly room rate with no tax
-- or service charge. Zero the stored rates so any code or report still reading
-- these columns agrees with the fixed 0 rates in lib/pricing. The admin UI no
-- longer exposes these fields.
update site_settings
set tax_rate = 0,
    service_charge_rate = 0;

-- Default future rows to 0 too, in case the singleton is ever re-seeded.
alter table site_settings
  alter column tax_rate set default 0,
  alter column service_charge_rate set default 0;
