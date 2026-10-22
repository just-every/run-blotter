-- SIGN-002 (ct 22 Oct): connection evidence at consent and signing, remote-authentication
-- attestations for Forms 2848 and 8821, and staff representatives who sign through
-- their own session. Connection evidence and attestations are erased with the signed record.
ALTER TABLE b_signatures ADD COLUMN attestation_required INTEGER NOT NULL DEFAULT 0 CHECK(attestation_required IN(0,1));
ALTER TABLE b_signature_signers ADD COLUMN signer_kind TEXT NOT NULL DEFAULT 'contact' CHECK(signer_kind IN('contact','staff'));
ALTER TABLE b_signature_signers ADD COLUMN connection_ip TEXT;
ALTER TABLE b_signature_signers ADD COLUMN connection_user_agent TEXT;
CREATE TABLE b_signature_attestations(
 request_id TEXT NOT NULL REFERENCES b_signatures(id), attempt INTEGER NOT NULL, contact_id TEXT NOT NULL,
 method TEXT NOT NULL CHECK(method IN('photo_id_selfie','photo_id_video','personal_knowledge')),
 verifier TEXT NOT NULL, verified_on TEXT NOT NULL, items TEXT NOT NULL CHECK(json_valid(items)),
 secondary_document TEXT, note TEXT, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 PRIMARY KEY(request_id,attempt,contact_id)
);
