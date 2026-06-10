-- Миграция auth.users → public.users
-- TablePlus: выделить ВСЁ (Cmd+A) → Run (Cmd+Enter)
-- Без BEGIN/COMMIT — TablePlus иногда выполняет только последний запрос.

INSERT INTO users (id, email, password_hash, email_verified, created_at, updated_at)
VALUES
  ('443f4c4f-ab6e-45f7-8a98-651baf8fa656', 'alex.l.ovchinnikov@gmail.com', NULL, true, '2026-05-16 16:45:45.579271+00', '2026-05-27 16:18:32.852754+00'),
  ('58a2b167-11fc-41b6-b0b0-9b7ba9964786', 'ilya@polusa.info', '$2a$10$GrNPifAnPuY04kl2uea0v.G.P/snj/wEguLB7QNMEkDB9YhwHmkOu', true, '2026-05-23 08:48:58.171413+00', '2026-05-23 08:49:13.97032+00'),
  ('b92f0d80-4771-4b94-91ca-6eaa0e4380d4', 'monia.ru+marinero.art-local-admin@gmail.com', '$2a$10$L9AFOTfTTKCUAJYCypvtsufM0X0afOXHIMXXverhBArk/ZpPLw3..', true, '2026-05-16 20:11:34.072056+00', '2026-05-23 00:34:21.20317+00'),
  ('04a5f92d-ebd2-455a-ab8f-ef71dde504b9', 'ilyakonrad.drums@gmail.com', NULL, true, '2026-05-16 17:06:58.941363+00', '2026-05-23 09:10:19.672146+00'),
  ('ccc94c4c-2577-43dc-b8e9-7e34189f458f', 'monia.ru@gmail.com', NULL, true, '2026-05-16 12:38:30.960543+00', '2026-05-29 17:57:47.983542+00'),
  ('17942f4b-afc5-4ab6-9748-18b77b457dd3', 'monia.ru+marinero.art-user@gmail.com', '$2a$10$1hYOg0o/647v2iKEk3JSNONIAOju5cLDXRXqveA/zTV6ZJNmRPDGW', true, '2026-05-16 17:06:26.041455+00', '2026-05-16 22:38:56.138662+00'),
  ('068c0bd3-fffe-4932-a7af-203b107b294b', 'monia.ru+marinero.art-user2@gmail.com', '$2a$10$JHBmyScwUVecOQTlw9BpkeTNBJlsZJrO40Fhr08kKdJqDqjFWPlkG', true, '2026-05-16 17:29:08.855939+00', '2026-05-18 20:46:14.601967+00'),
  ('38c2a0b0-dd80-4f4a-9e27-d46d540cf667', 'betomix.anna@gmail.com', NULL, true, '2026-05-17 10:09:03.227109+00', '2026-05-23 06:57:05.446706+00'),
  ('284b3143-d7c6-4695-8a62-a3496d1e4fa8', 'lokyflame@gmail.com', NULL, true, '2026-05-17 05:03:39.249721+00', '2026-05-17 15:12:58.543877+00'),
  ('cca4cf01-b5a7-4487-920b-0dd2f19bdd94', 'gchegis@gmail.com', NULL, true, '2026-05-23 10:21:24.47117+00', '2026-05-26 00:23:22.702377+00')
ON CONFLICT (id) DO NOTHING;

-- Проверка (должно быть 10 / 10 / 10):
SELECT
  (SELECT count(*) FROM users) AS users_count,
  (SELECT count(*) FROM profiles) AS profiles_count,
  (SELECT count(*) FROM profiles p JOIN users u ON u.id = p.id) AS linked_count;
