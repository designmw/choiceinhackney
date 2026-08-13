-- Migration number: 0002 	 contact form submissions
--
-- Every enquiry the contact form receives, kept on the site itself.
--
-- The point is not convenience. Today a submission exists only as an email: if
-- Brevo is down, the API key expires, the address bounces, or somebody deletes
-- the wrong thing in a shared inbox, the enquiry is simply gone and nobody
-- knows it existed. Writing it here first means the site holds the record and
-- the email becomes the notification rather than the storage.
--
-- That is why `delivered` exists: a row with delivered = 0 is an enquiry that
-- was received but whose email never went out, which is exactly the case that
-- was previously invisible.
--
-- NOTE ON PERSONAL DATA. This table holds names, email addresses, phone
-- numbers and free text written by members of the public — personal data under
-- GDPR. Before enabling it on a client site:
--   - say so in the privacy policy (what is stored, why, and for how long),
--   - agree a retention period and actually delete beyond it,
--   - remember that "delete my data" requests now have a second place to look.
-- The site's inbox always had this data too; the difference is that it is now
-- also on infrastructure you control, which is a change worth being explicit
-- about rather than a silent one.

CREATE TABLE IF NOT EXISTS contact_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  -- The page the form was submitted from, so an enquiry from a service page can
  -- be told from a general one.
  page TEXT NOT NULL DEFAULT '',
  -- 'new' until somebody marks it dealt with. Deliberately two states: a
  -- volunteer-run inbox does not need a workflow, it needs to know what is
  -- outstanding.
  status TEXT NOT NULL DEFAULT 'new',
  -- 1 when the notification email was accepted by Brevo, 0 when it failed.
  delivered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON contact_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions(status);
