ALTER TABLE pet_colors ADD COLUMN IF NOT EXISTS hex text;

UPDATE pet_colors SET hex = CASE lower(trim(name))
  WHEN 'black' THEN '#2A2A33'
  WHEN 'white' THEN '#F5F5F5'
  WHEN 'blue / gray' THEN '#6E7F95'
  WHEN 'gray' THEN '#9AA1AC'
  WHEN 'grey' THEN '#9AA1AC'
  WHEN 'silver' THEN '#9AA1AC'
  WHEN 'orange' THEN '#E0893A'
  WHEN 'brown' THEN '#7A5230'
  WHEN 'cream' THEN '#EAD9B8'
  WHEN 'golden' THEN '#D4A017'
  WHEN 'yellow' THEN '#E5C35A'
  WHEN 'red' THEN '#B54A3C'
  WHEN 'tan' THEN '#C4A574'
  WHEN 'chocolate' THEN '#5C3317'
  WHEN 'fawn' THEN '#C9A86A'
  ELSE hex
END
WHERE hex IS NULL;

INSERT INTO pet_colors (name, sort_order, hex)
SELECT 'Gray', 8, '#9AA1AC'
WHERE NOT EXISTS (SELECT 1 FROM pet_colors WHERE lower(name) = 'gray');
