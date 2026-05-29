-- Three sample room types and three rooms each, so the public listing
-- isn't empty at first boot. Idempotent (on conflict do nothing).

insert into room_types (name, slug, description, base_price, max_guests, amenities, sort_order)
values
  ('Standard',
   'standard',
   'A comfortable room with the essentials for a quiet stay.',
   2500.00, 2,
   array['Wi-Fi','Attached bathroom','Hot shower','Tea/Coffee','Television'],
   1),
  ('Deluxe',
   'deluxe',
   'Larger room with extra amenities and a city view.',
   4500.00, 2,
   array['Wi-Fi','Air conditioning','Mini-fridge','Television','City view','Workspace'],
   2),
  ('Suite',
   'suite',
   'Spacious suite with a separate sitting area and a balcony.',
   8500.00, 4,
   array['Wi-Fi','Air conditioning','Sitting area','Balcony','Kitchenette','Premium bedding'],
   3)
on conflict (slug) do nothing;

-- Rooms (101 / 102 / 103 for Standard, etc.)
insert into rooms (room_number, type_id, floor, status)
select '101', rt.id, 1, 'available' from room_types rt where rt.slug = 'standard' on conflict do nothing;
insert into rooms (room_number, type_id, floor, status)
select '102', rt.id, 1, 'available' from room_types rt where rt.slug = 'standard' on conflict do nothing;
insert into rooms (room_number, type_id, floor, status)
select '103', rt.id, 1, 'available' from room_types rt where rt.slug = 'standard' on conflict do nothing;

insert into rooms (room_number, type_id, floor, status)
select '201', rt.id, 2, 'available' from room_types rt where rt.slug = 'deluxe' on conflict do nothing;
insert into rooms (room_number, type_id, floor, status)
select '202', rt.id, 2, 'available' from room_types rt where rt.slug = 'deluxe' on conflict do nothing;
insert into rooms (room_number, type_id, floor, status)
select '203', rt.id, 2, 'available' from room_types rt where rt.slug = 'deluxe' on conflict do nothing;

insert into rooms (room_number, type_id, floor, status)
select '301', rt.id, 3, 'available' from room_types rt where rt.slug = 'suite' on conflict do nothing;
insert into rooms (room_number, type_id, floor, status)
select '302', rt.id, 3, 'available' from room_types rt where rt.slug = 'suite' on conflict do nothing;
insert into rooms (room_number, type_id, floor, status)
select '303', rt.id, 3, 'available' from room_types rt where rt.slug = 'suite' on conflict do nothing;
