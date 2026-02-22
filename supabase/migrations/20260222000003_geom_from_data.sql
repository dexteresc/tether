-- Auto-populate geom column from data->>'lat' and data->>'lng' on INSERT/UPDATE

CREATE OR REPLACE FUNCTION public.set_geom_from_data()
RETURNS TRIGGER AS $$
DECLARE
  lat double precision;
  lng double precision;
BEGIN
  lat := (NEW.data->>'lat')::double precision;
  lng := (NEW.data->>'lng')::double precision;

  IF lat IS NOT NULL AND lng IS NOT NULL
     AND lat BETWEEN -90 AND 90
     AND lng BETWEEN -180 AND 180
  THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(lng, lat), 4326);
  ELSE
    NEW.geom := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for entities
DROP TRIGGER IF EXISTS trg_entities_set_geom ON public.entities;
CREATE TRIGGER trg_entities_set_geom
  BEFORE INSERT OR UPDATE ON public.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_geom_from_data();

-- Trigger for intel
DROP TRIGGER IF EXISTS trg_intel_set_geom ON public.intel;
CREATE TRIGGER trg_intel_set_geom
  BEFORE INSERT OR UPDATE ON public.intel
  FOR EACH ROW
  EXECUTE FUNCTION public.set_geom_from_data();
