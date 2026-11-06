-- Add abortions and living columns to patients table for complete GPAL obstetric history.
ALTER TABLE patients ADD COLUMN abortions INTEGER;
ALTER TABLE patients ADD COLUMN living INTEGER;
