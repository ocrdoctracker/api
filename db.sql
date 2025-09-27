BEGIN;

CREATE SCHEMA IF NOT EXISTS dbo;

-- Departments
CREATE TABLE IF NOT EXISTS dbo."Department" (
  "DepartmentId" BIGINT GENERATED ALWAYS AS IDENTITY
    (INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1),
  "Name"   VARCHAR NOT NULL,
  "Active" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("DepartmentId")
);

-- Users
CREATE TABLE IF NOT EXISTS dbo."User" (
  "UserId" BIGINT GENERATED ALWAYS AS IDENTITY
    (INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1),
  "Name"         VARCHAR NOT NULL,
  "Username"     VARCHAR NOT NULL,
  "Email"        VARCHAR NOT NULL,
  "Password"     VARCHAR NOT NULL,
  "DepartmentId" BIGINT NOT NULL,
  "Active"       BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "User_pkey" PRIMARY KEY ("UserId")
);

-- Doc Requests
CREATE TABLE IF NOT EXISTS dbo."DocRequest" (
  "DocRequestId" BIGINT GENERATED ALWAYS AS IDENTITY
    (INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1),
  "FromUserId"           BIGINT NOT NULL,
  "Purpose"              VARCHAR NOT NULL,
  "DateRequested"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "AssignedDepartmentId" BIGINT NOT NULL,
  "DateAssigned"         TIMESTAMPTZ,
  "DateProcessStarted"   TIMESTAMPTZ,
  "DateProcessEnd"       TIMESTAMPTZ,
  "DateCompleted"        TIMESTAMPTZ,
  "DateClosed"           TIMESTAMPTZ,
  "DateLastUpdated"      TIMESTAMPTZ,
  "RequestStatus"        VARCHAR NOT NULL DEFAULT 'PENDING',
  "Description"          VARCHAR NOT NULL,
  "RejectReason"         VARCHAR,
  "CancelReason"         VARCHAR,
  "RequestNo" TEXT GENERATED ALWAYS AS ('D-' || lpad(("DocRequestId")::text, 6, '0')) STORED,
  "DocumentFile" JSONB,
  "Classification" JSONB,
  CONSTRAINT "DocRequest_pkey" PRIMARY KEY ("DocRequestId")
);

-- Ensure UNIQUEs (guarded). If duplicates exist, this will fail: clean data first.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_User_Username') THEN
    ALTER TABLE dbo."User" ADD CONSTRAINT "uq_User_Username" UNIQUE ("Username");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_User_Email') THEN
    ALTER TABLE dbo."User" ADD CONSTRAINT "uq_User_Email" UNIQUE ("Email");
  END IF;
END$$;

-- Foreign keys (guarded)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_User_Department') THEN
    ALTER TABLE dbo."User"
      ADD CONSTRAINT "fk_User_Department"
      FOREIGN KEY ("DepartmentId")
      REFERENCES dbo."Department" ("DepartmentId")
      ON UPDATE NO ACTION ON DELETE NO ACTION;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_DocRequest_AssignedDepartment') THEN
    ALTER TABLE dbo."DocRequest"
      ADD CONSTRAINT "fk_DocRequest_AssignedDepartment"
      FOREIGN KEY ("AssignedDepartmentId")
      REFERENCES dbo."Department" ("DepartmentId")
      ON UPDATE NO ACTION ON DELETE NO ACTION;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_DocRequest_FromUser') THEN
    ALTER TABLE dbo."DocRequest"
      ADD CONSTRAINT "fk_DocRequest_FromUser"
      FOREIGN KEY ("FromUserId")
      REFERENCES dbo."User" ("UserId")
      ON UPDATE NO ACTION ON DELETE NO ACTION;
  END IF;
END$$;

-- Helpful index
CREATE INDEX IF NOT EXISTS "idx_DocRequest_RequestStatus"
  ON dbo."DocRequest" ("RequestStatus");

-- Reset procedure (safe to recreate)
CREATE OR REPLACE PROCEDURE dbo.reset()
LANGUAGE plpgsql
AS $$
BEGIN
  TRUNCATE TABLE
    dbo."DocRequest",
    dbo."User",
    dbo."Department"
  RESTART IDENTITY CASCADE;

  INSERT INTO dbo."Department" ("Name") VALUES ('Admin');

  INSERT INTO dbo."User" ("Name","Username","Email","Password","DepartmentId")
  VALUES (
    'Admin',
    'admin',
    'admin@email.com',
    '$2b$10$LqN3kzfgaYnP5PfDZFfT4edUFqh5Lu7amIxeDDDmu/KEqQFze.p8a',
    1
  );
END;
$$;

COMMIT;


CALL dbo.reset();