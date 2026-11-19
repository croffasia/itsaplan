CREATE TABLE project_weekly_report (
  project_id integer NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  document_id integer NOT NULL UNIQUE REFERENCES project_document(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, week_start)
);
