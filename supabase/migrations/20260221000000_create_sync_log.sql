


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_user_entity"("p_email" "text", "p_name" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_entity_id UUID;
  v_user_id UUID;
BEGIN
  -- Use provided user_id or get from auth context
  v_user_id := COALESCE(p_user_id, auth.uid());

  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email cannot be empty';
  END IF;

  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION 'Name cannot be empty';
  END IF;

  -- Create entity with user metadata
  INSERT INTO entities (type, data)
  VALUES (
    'person',
    jsonb_build_object(
      'user', true,
      'name', p_name,
      'user_id', v_user_id
    )
  )
  RETURNING id INTO v_entity_id;

  -- Create email identifier
  INSERT INTO identifiers (entity_id, type, value)
  VALUES (v_entity_id, 'email', p_email);

  -- Create name identifier
  INSERT INTO identifiers (entity_id, type, value)
  VALUES (v_entity_id, 'name', p_name);

  RETURN v_entity_id;
END;
$$;


ALTER FUNCTION "public"."create_user_entity"("p_email" "text", "p_name" "text", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_user_entity"("p_email" "text", "p_name" "text", "p_user_id" "uuid") IS 'Creates a person entity with email and name identifiers. Used during user signup.';



CREATE OR REPLACE FUNCTION "public"."get_entity_graph"("p_entity_id" "uuid", "p_depth" integer DEFAULT 2) RETURNS TABLE("entity_id" "uuid", "entity_type" character varying, "entity_data" "jsonb", "relation_id" "uuid", "relation_type" character varying, "relation_source_id" "uuid", "relation_target_id" "uuid", "relation_strength" smallint, "depth" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE entity_graph AS (
    -- Base case: Get the root entity
    SELECT
      e.id as entity_id,
      e.type as entity_type,
      e.data as entity_data,
      NULL::UUID as relation_id,
      NULL::VARCHAR(30) as relation_type,
      NULL::UUID as relation_source_id,
      NULL::UUID as relation_target_id,
      NULL::SMALLINT as relation_strength,
      0 as depth
    FROM entities e
    WHERE e.id = p_entity_id
      AND e.deleted_at IS NULL

    UNION

    -- Recursive case: Direct relations (outgoing)
    SELECT
      e.id,
      e.type,
      e.data,
      r.id,
      r.type,
      r.source_id,
      r.target_id,
      r.strength,
      1 as depth
    FROM entities e
    INNER JOIN relations r ON r.target_id = e.id
    WHERE r.source_id = p_entity_id
      AND r.deleted_at IS NULL
      AND e.deleted_at IS NULL

    UNION

    -- Recursive case: Direct relations (incoming)
    SELECT
      e.id,
      e.type,
      e.data,
      r.id,
      r.type,
      r.source_id,
      r.target_id,
      r.strength,
      1 as depth
    FROM entities e
    INNER JOIN relations r ON r.source_id = e.id
    WHERE r.target_id = p_entity_id
      AND r.deleted_at IS NULL
      AND e.deleted_at IS NULL

    UNION ALL

    -- Recursive case: Traverse deeper (outgoing)
    SELECT
      e.id,
      e.type,
      e.data,
      r.id,
      r.type,
      r.source_id,
      r.target_id,
      r.strength,
      eg.depth + 1
    FROM entity_graph eg
    INNER JOIN relations r ON r.source_id = eg.entity_id
    INNER JOIN entities e ON e.id = r.target_id
    WHERE eg.depth < p_depth
      AND r.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND eg.entity_id != p_entity_id  -- Avoid returning to root

    UNION ALL

    -- Recursive case: Traverse deeper (incoming)
    SELECT
      e.id,
      e.type,
      e.data,
      r.id,
      r.type,
      r.source_id,
      r.target_id,
      r.strength,
      eg.depth + 1
    FROM entity_graph eg
    INNER JOIN relations r ON r.target_id = eg.entity_id
    INNER JOIN entities e ON e.id = r.source_id
    WHERE eg.depth < p_depth
      AND r.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND eg.entity_id != p_entity_id  -- Avoid returning to root
  )
  SELECT DISTINCT ON (eg.entity_id)
    eg.entity_id,
    eg.entity_type,
    eg.entity_data,
    eg.relation_id,
    eg.relation_type,
    eg.relation_source_id,
    eg.relation_target_id,
    eg.relation_strength,
    eg.depth
  FROM entity_graph eg
  ORDER BY eg.entity_id, eg.depth;
END;
$$;


ALTER FUNCTION "public"."get_entity_graph"("p_entity_id" "uuid", "p_depth" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_entity_graph"("p_entity_id" "uuid", "p_depth" integer) IS 'Recursively traverse entity relationships up to specified depth. Returns graph data for visualization.';



CREATE OR REPLACE FUNCTION "public"."get_entity_with_details"("p_entity_id" "uuid") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'entity', row_to_json(e.*),
    'identifiers', (
      SELECT json_agg(row_to_json(i.*))
      FROM identifiers i
      WHERE i.entity_id = p_entity_id
        AND i.deleted_at IS NULL
    ),
    'relations_out', (
      SELECT json_agg(
        json_build_object(
          'relation', row_to_json(r.*),
          'target_entity', row_to_json(te.*)
        )
      )
      FROM relations r
      INNER JOIN entities te ON te.id = r.target_id
      WHERE r.source_id = p_entity_id
        AND r.deleted_at IS NULL
        AND te.deleted_at IS NULL
    ),
    'relations_in', (
      SELECT json_agg(
        json_build_object(
          'relation', row_to_json(r.*),
          'source_entity', row_to_json(se.*)
        )
      )
      FROM relations r
      INNER JOIN entities se ON se.id = r.source_id
      WHERE r.target_id = p_entity_id
        AND r.deleted_at IS NULL
        AND se.deleted_at IS NULL
    ),
    'intel', (
      SELECT json_agg(
        json_build_object(
          'intel', row_to_json(i.*),
          'intel_entity', row_to_json(ie.*)
        )
      )
      FROM intel_entities ie
      INNER JOIN intel i ON i.id = ie.intel_id
      WHERE ie.entity_id = p_entity_id
        AND ie.deleted_at IS NULL
        AND i.deleted_at IS NULL
    )
  )
  INTO v_result
  FROM entities e
  WHERE e.id = p_entity_id
    AND e.deleted_at IS NULL;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_entity_with_details"("p_entity_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_entity_with_details"("p_entity_id" "uuid") IS 'Get complete entity details including identifiers, relations, and linked intelligence';



CREATE OR REPLACE FUNCTION "public"."search_entities_by_identifier"("p_search_value" "text", "p_identifier_type" character varying DEFAULT NULL::character varying) RETURNS TABLE("entity_id" "uuid", "entity_type" character varying, "entity_data" "jsonb", "identifier_type" character varying, "identifier_value" "text", "identifier_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.type,
    e.data,
    i.type,
    i.value,
    i.id
  FROM entities e
  INNER JOIN identifiers i ON i.entity_id = e.id
  WHERE i.value ILIKE '%' || p_search_value || '%'
    AND (p_identifier_type IS NULL OR i.type = p_identifier_type)
    AND e.deleted_at IS NULL
    AND i.deleted_at IS NULL
  ORDER BY
    CASE WHEN i.value ILIKE p_search_value THEN 0 ELSE 1 END,  -- Exact matches first
    i.value;
END;
$$;


ALTER FUNCTION "public"."search_entities_by_identifier"("p_search_value" "text", "p_identifier_type" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_entities_by_identifier"("p_search_value" "text", "p_identifier_type" character varying) IS 'Search for entities by identifier value (name, email, phone, etc.)';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_updated_at_column"() IS 'Trigger function to automatically update updated_at timestamp';



CREATE OR REPLACE FUNCTION "public"."write_sync_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO sync_log (table_name, record_id, operation, row_data)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO sync_log (table_name, record_id, operation, row_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSE -- UPDATE
    INSERT INTO sync_log (table_name, record_id, operation, row_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(NEW)::jsonb);
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."write_sync_log"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."write_sync_log"() IS 'AFTER trigger function that appends to sync_log for every mutation';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" character varying(20) NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "entities_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['person'::character varying, 'organization'::character varying, 'group'::character varying, 'vehicle'::character varying, 'location'::character varying])::"text"[]))),
    CONSTRAINT "valid_entity_type" CHECK ((("type")::"text" = ANY ((ARRAY['person'::character varying, 'organization'::character varying, 'group'::character varying, 'vehicle'::character varying, 'location'::character varying, 'event'::character varying])::"text"[])))
);


ALTER TABLE "public"."entities" OWNER TO "postgres";


COMMENT ON TABLE "public"."entities" IS 'Core entities in the intelligence system';



COMMENT ON COLUMN "public"."entities"."data" IS 'JSONB field for flexible entity-specific data';



CREATE TABLE IF NOT EXISTS "public"."identifiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "type" character varying(20) NOT NULL,
    "value" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "identifiers_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['name'::character varying, 'document'::character varying, 'biometric'::character varying, 'phone'::character varying, 'email'::character varying, 'handle'::character varying, 'address'::character varying, 'registration'::character varying, 'domain'::character varying])::"text"[]))),
    CONSTRAINT "valid_identifier_type" CHECK ((("type")::"text" = ANY ((ARRAY['name'::character varying, 'document'::character varying, 'biometric'::character varying, 'phone'::character varying, 'email'::character varying, 'handle'::character varying, 'address'::character varying, 'registration'::character varying, 'domain'::character varying])::"text"[])))
);


ALTER TABLE "public"."identifiers" OWNER TO "postgres";


COMMENT ON TABLE "public"."identifiers" IS 'Multiple identifiers for each entity (name, email, phone, etc.)';



COMMENT ON COLUMN "public"."identifiers"."metadata" IS 'Additional metadata about the identifier';



CREATE TABLE IF NOT EXISTS "public"."intel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" character varying(20) NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "data" "jsonb" NOT NULL,
    "source_id" "uuid",
    "confidence" character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "intel_confidence_check" CHECK ((("confidence")::"text" = ANY ((ARRAY['confirmed'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying, 'unconfirmed'::character varying])::"text"[]))),
    CONSTRAINT "intel_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['event'::character varying, 'communication'::character varying, 'sighting'::character varying, 'report'::character varying, 'document'::character varying, 'media'::character varying, 'financial'::character varying])::"text"[]))),
    CONSTRAINT "valid_confidence" CHECK ((("confidence")::"text" = ANY ((ARRAY['confirmed'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying, 'unconfirmed'::character varying])::"text"[]))),
    CONSTRAINT "valid_intel_type" CHECK ((("type")::"text" = ANY ((ARRAY['event'::character varying, 'communication'::character varying, 'sighting'::character varying, 'report'::character varying, 'document'::character varying, 'media'::character varying, 'financial'::character varying])::"text"[])))
);


ALTER TABLE "public"."intel" OWNER TO "postgres";


COMMENT ON TABLE "public"."intel" IS 'Intelligence records with occurrence time and confidence levels';



COMMENT ON COLUMN "public"."intel"."occurred_at" IS 'When the intelligence event occurred (not when it was recorded)';



COMMENT ON COLUMN "public"."intel"."confidence" IS 'Confidence level: confirmed, high, medium, low, or unconfirmed';



CREATE TABLE IF NOT EXISTS "public"."intel_entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intel_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "role" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."intel_entities" OWNER TO "postgres";


COMMENT ON TABLE "public"."intel_entities" IS 'Links intelligence records to entities with optional role';



COMMENT ON COLUMN "public"."intel_entities"."role" IS 'Role of the entity in the intelligence (e.g., subject, witness, source)';



CREATE TABLE IF NOT EXISTS "public"."relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "type" character varying(30) NOT NULL,
    "strength" smallint,
    "valid_from" "date",
    "valid_to" "date",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "no_self_relation" CHECK (("source_id" <> "target_id")),
    CONSTRAINT "relations_strength_check" CHECK ((("strength" IS NULL) OR (("strength" >= 1) AND ("strength" <= 10)))),
    CONSTRAINT "valid_relation_type" CHECK ((("type")::"text" = ANY ((ARRAY['parent'::character varying, 'child'::character varying, 'sibling'::character varying, 'spouse'::character varying, 'colleague'::character varying, 'associate'::character varying, 'friend'::character varying, 'member'::character varying, 'owner'::character varying, 'founder'::character varying, 'co-founder'::character varying, 'visited'::character varying, 'employee'::character varying])::"text"[]))),
    CONSTRAINT "valid_strength" CHECK ((("strength" IS NULL) OR (("strength" >= 1) AND ("strength" <= 10))))
);


ALTER TABLE "public"."relations" OWNER TO "postgres";


COMMENT ON TABLE "public"."relations" IS 'Relationships between entities with strength and temporal validity';



COMMENT ON COLUMN "public"."relations"."strength" IS 'Relationship strength (1-10)';



COMMENT ON COLUMN "public"."relations"."valid_from" IS 'Start date of relationship validity';



COMMENT ON COLUMN "public"."relations"."valid_to" IS 'End date of relationship validity';



CREATE TABLE IF NOT EXISTS "public"."sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "type" character varying(20) NOT NULL,
    "reliability" character(1) NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "sources_reliability_check" CHECK (("reliability" = ANY (ARRAY['A'::"bpchar", 'B'::"bpchar", 'C'::"bpchar", 'D'::"bpchar", 'E'::"bpchar", 'F'::"bpchar"]))),
    CONSTRAINT "valid_reliability" CHECK (("reliability" = ANY (ARRAY['A'::"bpchar", 'B'::"bpchar", 'C'::"bpchar", 'D'::"bpchar", 'E'::"bpchar", 'F'::"bpchar"])))
);


ALTER TABLE "public"."sources" OWNER TO "postgres";


COMMENT ON TABLE "public"."sources" IS 'Data sources with reliability ratings (A=completely reliable to F=cannot be judged)';



COMMENT ON COLUMN "public"."sources"."reliability" IS 'A=Completely reliable, B=Usually reliable, C=Fairly reliable, D=Not usually reliable, E=Unreliable, F=Cannot be judged';



CREATE TABLE IF NOT EXISTS "public"."sync_log" (
    "seq" bigint NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" "text" NOT NULL,
    "row_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sync_log_operation_check" CHECK (("operation" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."sync_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."sync_log" IS 'Append-only event log for sync — clients consume via monotonic seq cursor';



CREATE SEQUENCE IF NOT EXISTS "public"."sync_log_seq_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sync_log_seq_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sync_log_seq_seq" OWNED BY "public"."sync_log"."seq";



ALTER TABLE ONLY "public"."sync_log" ALTER COLUMN "seq" SET DEFAULT "nextval"('"public"."sync_log_seq_seq"'::"regclass");



ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "entities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."identifiers"
    ADD CONSTRAINT "identifiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intel_entities"
    ADD CONSTRAINT "intel_entities_intel_id_entity_id_key" UNIQUE ("intel_id", "entity_id");



ALTER TABLE ONLY "public"."intel_entities"
    ADD CONSTRAINT "intel_entities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intel"
    ADD CONSTRAINT "intel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relations"
    ADD CONSTRAINT "relations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sources"
    ADD CONSTRAINT "sources_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."sources"
    ADD CONSTRAINT "sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_log"
    ADD CONSTRAINT "sync_log_pkey" PRIMARY KEY ("seq");



CREATE INDEX "idx_entities_data_gin" ON "public"."entities" USING "gin" ("data");



CREATE INDEX "idx_entities_deleted_at" ON "public"."entities" USING "btree" ("deleted_at");



CREATE INDEX "idx_entities_type" ON "public"."entities" USING "btree" ("type");



CREATE INDEX "idx_identifiers_deleted_at" ON "public"."identifiers" USING "btree" ("deleted_at");



CREATE INDEX "idx_identifiers_entity_id" ON "public"."identifiers" USING "btree" ("entity_id");



CREATE INDEX "idx_identifiers_type_value" ON "public"."identifiers" USING "btree" ("type", "value");



CREATE INDEX "idx_intel_confidence" ON "public"."intel" USING "btree" ("confidence");



CREATE INDEX "idx_intel_data_gin" ON "public"."intel" USING "gin" ("data");



CREATE INDEX "idx_intel_deleted_at" ON "public"."intel" USING "btree" ("deleted_at");



CREATE INDEX "idx_intel_entities_deleted_at" ON "public"."intel_entities" USING "btree" ("deleted_at");



CREATE INDEX "idx_intel_entities_entity_id" ON "public"."intel_entities" USING "btree" ("entity_id");



CREATE INDEX "idx_intel_entities_intel_id" ON "public"."intel_entities" USING "btree" ("intel_id");



CREATE INDEX "idx_intel_occurred_at" ON "public"."intel" USING "btree" ("occurred_at");



CREATE INDEX "idx_intel_source_id" ON "public"."intel" USING "btree" ("source_id");



CREATE INDEX "idx_intel_type" ON "public"."intel" USING "btree" ("type");



CREATE INDEX "idx_relations_deleted_at" ON "public"."relations" USING "btree" ("deleted_at");



CREATE INDEX "idx_relations_source_id" ON "public"."relations" USING "btree" ("source_id");



CREATE INDEX "idx_relations_target_id" ON "public"."relations" USING "btree" ("target_id");



CREATE INDEX "idx_relations_type" ON "public"."relations" USING "btree" ("type");



CREATE INDEX "idx_relations_valid_dates" ON "public"."relations" USING "btree" ("valid_from", "valid_to");



CREATE INDEX "idx_sources_active" ON "public"."sources" USING "btree" ("active");



CREATE INDEX "idx_sources_code" ON "public"."sources" USING "btree" ("code");



CREATE INDEX "idx_sources_deleted_at" ON "public"."sources" USING "btree" ("deleted_at");



CREATE INDEX "idx_sync_log_created_at" ON "public"."sync_log" USING "btree" ("created_at");



CREATE OR REPLACE TRIGGER "trg_sync_log_entities" AFTER INSERT OR DELETE OR UPDATE ON "public"."entities" FOR EACH ROW EXECUTE FUNCTION "public"."write_sync_log"();



CREATE OR REPLACE TRIGGER "trg_sync_log_identifiers" AFTER INSERT OR DELETE OR UPDATE ON "public"."identifiers" FOR EACH ROW EXECUTE FUNCTION "public"."write_sync_log"();



CREATE OR REPLACE TRIGGER "trg_sync_log_intel" AFTER INSERT OR DELETE OR UPDATE ON "public"."intel" FOR EACH ROW EXECUTE FUNCTION "public"."write_sync_log"();



CREATE OR REPLACE TRIGGER "trg_sync_log_intel_entities" AFTER INSERT OR DELETE OR UPDATE ON "public"."intel_entities" FOR EACH ROW EXECUTE FUNCTION "public"."write_sync_log"();



CREATE OR REPLACE TRIGGER "trg_sync_log_relations" AFTER INSERT OR DELETE OR UPDATE ON "public"."relations" FOR EACH ROW EXECUTE FUNCTION "public"."write_sync_log"();



CREATE OR REPLACE TRIGGER "trg_sync_log_sources" AFTER INSERT OR DELETE OR UPDATE ON "public"."sources" FOR EACH ROW EXECUTE FUNCTION "public"."write_sync_log"();



CREATE OR REPLACE TRIGGER "update_entities_updated_at" BEFORE UPDATE ON "public"."entities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_identifiers_updated_at" BEFORE UPDATE ON "public"."identifiers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_intel_entities_updated_at" BEFORE UPDATE ON "public"."intel_entities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_intel_updated_at" BEFORE UPDATE ON "public"."intel" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_relations_updated_at" BEFORE UPDATE ON "public"."relations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sources_updated_at" BEFORE UPDATE ON "public"."sources" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."identifiers"
    ADD CONSTRAINT "identifiers_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_entities"
    ADD CONSTRAINT "intel_entities_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel_entities"
    ADD CONSTRAINT "intel_entities_intel_id_fkey" FOREIGN KEY ("intel_id") REFERENCES "public"."intel"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intel"
    ADD CONSTRAINT "intel_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."relations"
    ADD CONSTRAINT "relations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relations"
    ADD CONSTRAINT "relations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can read sync_log" ON "public"."sync_log" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can delete identifiers for own entities" ON "public"."identifiers" FOR DELETE USING ((("auth"."uid"() IS NOT NULL) AND ("entity_id" IN ( SELECT "entities"."id"
   FROM "public"."entities"
  WHERE ((("entities"."data" ->> 'user_id'::"text"))::"uuid" = "auth"."uid"())))));



CREATE POLICY "Users can delete intel" ON "public"."intel" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can delete intel_entities" ON "public"."intel_entities" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can delete relations" ON "public"."relations" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can delete sources" ON "public"."sources" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can insert entities" ON "public"."entities" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can insert identifiers" ON "public"."identifiers" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can insert intel" ON "public"."intel" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can insert intel_entities" ON "public"."intel_entities" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can insert relations" ON "public"."relations" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can insert sources" ON "public"."sources" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can read all entities" ON "public"."entities" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can read all identifiers" ON "public"."identifiers" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can read all intel" ON "public"."intel" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can read all intel_entities" ON "public"."intel_entities" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can read all relations" ON "public"."relations" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can read all sources" ON "public"."sources" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can soft delete own entities" ON "public"."entities" FOR UPDATE USING ((("auth"."uid"() IS NOT NULL) AND (((("data" ->> 'user_id'::"text"))::"uuid" = "auth"."uid"()) OR ("id" IN ( SELECT "identifiers"."entity_id"
   FROM "public"."identifiers"
  WHERE ((("identifiers"."type")::"text" = 'email'::"text") AND ("identifiers"."value" = "auth"."email"())))))));



CREATE POLICY "Users can update identifiers for own entities" ON "public"."identifiers" FOR UPDATE USING ((("auth"."uid"() IS NOT NULL) AND ("entity_id" IN ( SELECT "entities"."id"
   FROM "public"."entities"
  WHERE ((("entities"."data" ->> 'user_id'::"text"))::"uuid" = "auth"."uid"())))));



CREATE POLICY "Users can update intel" ON "public"."intel" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can update intel_entities" ON "public"."intel_entities" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can update own entities" ON "public"."entities" FOR UPDATE USING ((("auth"."uid"() IS NOT NULL) AND (((("data" ->> 'user_id'::"text"))::"uuid" = "auth"."uid"()) OR ("id" IN ( SELECT "identifiers"."entity_id"
   FROM "public"."identifiers"
  WHERE ((("identifiers"."type")::"text" = 'email'::"text") AND ("identifiers"."value" = "auth"."email"())))))));



CREATE POLICY "Users can update relations" ON "public"."relations" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can update sources" ON "public"."sources" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."entities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."identifiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intel_entities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_log" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."create_user_entity"("p_email" "text", "p_name" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_entity"("p_email" "text", "p_name" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_entity"("p_email" "text", "p_name" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_entity_graph"("p_entity_id" "uuid", "p_depth" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_entity_graph"("p_entity_id" "uuid", "p_depth" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_entity_graph"("p_entity_id" "uuid", "p_depth" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_entity_with_details"("p_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_entity_with_details"("p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_entity_with_details"("p_entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_entities_by_identifier"("p_search_value" "text", "p_identifier_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."search_entities_by_identifier"("p_search_value" "text", "p_identifier_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_entities_by_identifier"("p_search_value" "text", "p_identifier_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."write_sync_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."write_sync_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."write_sync_log"() TO "service_role";


















GRANT ALL ON TABLE "public"."entities" TO "anon";
GRANT ALL ON TABLE "public"."entities" TO "authenticated";
GRANT ALL ON TABLE "public"."entities" TO "service_role";



GRANT ALL ON TABLE "public"."identifiers" TO "anon";
GRANT ALL ON TABLE "public"."identifiers" TO "authenticated";
GRANT ALL ON TABLE "public"."identifiers" TO "service_role";



GRANT ALL ON TABLE "public"."intel" TO "anon";
GRANT ALL ON TABLE "public"."intel" TO "authenticated";
GRANT ALL ON TABLE "public"."intel" TO "service_role";



GRANT ALL ON TABLE "public"."intel_entities" TO "anon";
GRANT ALL ON TABLE "public"."intel_entities" TO "authenticated";
GRANT ALL ON TABLE "public"."intel_entities" TO "service_role";



GRANT ALL ON TABLE "public"."relations" TO "anon";
GRANT ALL ON TABLE "public"."relations" TO "authenticated";
GRANT ALL ON TABLE "public"."relations" TO "service_role";



GRANT ALL ON TABLE "public"."sources" TO "anon";
GRANT ALL ON TABLE "public"."sources" TO "authenticated";
GRANT ALL ON TABLE "public"."sources" TO "service_role";



GRANT ALL ON TABLE "public"."sync_log" TO "anon";
GRANT ALL ON TABLE "public"."sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sync_log_seq_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sync_log_seq_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sync_log_seq_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

