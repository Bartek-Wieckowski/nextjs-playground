-- Sprawdź user_metadata dla wszystkich userów
SELECT 
  id,
  email,
  raw_user_meta_data,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Sprawdź czy jest super admin
SELECT * FROM super_admins;

-- Sprawdź profile
SELECT * FROM profiles;
