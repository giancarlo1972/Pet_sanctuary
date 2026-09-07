DROP POLICY IF EXISTS pv_insert_as_owner ON pet_vaccinations;
CREATE POLICY pv_insert_as_owner ON pet_vaccinations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pets p WHERE p.id = pet_vaccinations.pet_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS lp_insert_as_owner ON lab_panels;
CREATE POLICY lp_insert_as_owner ON lab_panels
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pets p WHERE p.id = lab_panels.pet_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS lr_insert_as_owner ON lab_results;
CREATE POLICY lr_insert_as_owner ON lab_results
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_panels lp JOIN pets p ON p.id = lp.pet_id
    WHERE lp.id = lab_results.panel_id AND p.owner_id = auth.uid()
  ));
