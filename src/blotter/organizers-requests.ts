// Current organizer requests are visible only to their assigned entity contact.
// Ordinary engagement requests keep their existing entity-contact visibility.
export const contactRequestSql = (r = 'r') => `${r}.organizer_active=1 AND (NOT EXISTS(SELECT 1 FROM b_organizer_requests m WHERE m.request_id=${r}.id) OR EXISTS(
  SELECT 1 FROM b_organizer_requests m JOIN b_organizer_answers a ON a.organizer_id=m.organizer_id AND a.key=m.key
  JOIN b_job_organizers o ON o.id=a.organizer_id WHERE m.request_id=${r}.id AND a.contact_id=? AND o.erased_at IS NULL))`;
