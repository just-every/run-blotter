// PORTAL-005: the client-facing text in English and Spanish. One catalog is shared by the
// server (emails, progress text, the unsubscribe page) and the client screens, so a contact's
// language preference is the only switch. Keys are plain strings; {name} fills a value.
export const LANGUAGES = ['en', 'es'] as const;
export type Language = typeof LANGUAGES[number];
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', es: 'Español' };
export const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

type Entry = { en: string; es: string };
const C = {
  // The client link page
  'portal.title': { en: 'Document upload', es: 'Carga de documentos' },
  'portal.opening': { en: 'Opening your request…', es: 'Abriendo su solicitud…' },
  'portal.openFailed': { en: 'This link cannot be opened', es: 'No se puede abrir este enlace' },
  'portal.heading': { en: 'Documents for {job}', es: 'Documentos para {job}' },
  'portal.intro': { en: '{client} · {period} · please upload by {due}. This link expires {expires}. Files up to 1 MiB each.', es: '{client} · {period} · cárguelos antes del {due}. Este enlace vence el {expires}. Archivos de hasta 1 MiB cada uno.' },
  'portal.uploadDone': { en: 'Uploaded {name}. Thank you.', es: 'Se cargó {name}. Gracias.' },
  'portal.uploadFailed': { en: 'Upload failed', es: 'No se pudo cargar el archivo' },
  'portal.asks': { en: 'Your accountant asks: {note}', es: 'Su contador le pide: {note}' },
  'portal.uploadedFile': { en: 'Uploaded {name} · {when}', es: 'Cargado {name} · {when}' },
  'portal.chooseFile': { en: 'Choose a file to upload', es: 'Elija un archivo para cargar' },
  'portal.sharedFiles': { en: 'Shared files', es: 'Archivos compartidos' },
  'portal.language': { en: 'Language', es: 'Idioma' },
  'portal.skip': { en: 'Skip to your documents', es: 'Saltar a sus documentos' },
  'status.requested': { en: 'requested', es: 'solicitado' }, 'status.received': { en: 'received', es: 'recibido' }, 'status.accepted': { en: 'accepted', es: 'aceptado' },
  'status.sent': { en: 'sent', es: 'enviado' }, 'status.approved': { en: 'approved', es: 'aprobado' }, 'status.changes_requested': { en: 'changes requested', es: 'cambios solicitados' },
  'status.pending': { en: 'pending', es: 'pendiente' }, 'status.completed': { en: 'completed', es: 'completado' }, 'status.signed': { en: 'signed', es: 'firmado' },
  'status.declined': { en: 'declined', es: 'rechazado' }, 'status.issued': { en: 'issued', es: 'emitida' }, 'status.void': { en: 'void', es: 'anulada' },
  'status.expired': { en: 'expired', es: 'vencido' }, 'status.voided': { en: 'voided', es: 'anulado' }, 'status.retained': { en: 'retained', es: 'conservado' }, 'status.not_required': { en: 'not required', es: 'no se requiere' },
  'status.open': { en: 'open', es: 'abierto' }, 'status.done': { en: 'done', es: 'hecho' },
  // Progress (server-written for the contact's language)
  'progress.title': { en: 'Where things stand', es: 'Cómo va su trabajo' },
  'progress.status': { en: 'Status:', es: 'Estado:' }, 'progress.next': { en: 'Next step:', es: 'Próximo paso:' },
  'stage.planned': { en: 'Planned', es: 'Planeado' }, 'stage.ready': { en: 'Ready to start', es: 'Listo para comenzar' }, 'stage.in_progress': { en: 'In progress', es: 'En curso' },
  'stage.waiting': { en: 'Waiting', es: 'En espera' }, 'stage.in_review': { en: 'In review', es: 'En revisión' }, 'stage.completed': { en: 'Completed', es: 'Completado' },
  'progress.upload': { en: 'upload {n} {document}', es: 'cargue {n} {document}' }, 'progress.todo': { en: 'complete {n} {todo}', es: 'complete {n} {todo}' },
  'progress.document.one': { en: 'document', es: 'documento' }, 'progress.document.other': { en: 'documents', es: 'documentos' },
  'progress.todo.one': { en: 'to-do', es: 'tarea' }, 'progress.todo.other': { en: 'to-dos', es: 'tareas' },
  'progress.please': { en: 'Please {actions}.', es: 'Por favor, {actions}.' }, 'progress.and': { en: ' and ', es: ' y ' },
  'progress.nothing.completed': { en: 'Nothing needed from you: the work is complete.', es: 'No necesitamos nada de usted: el trabajo está completo.' },
  'progress.nothing.in_review': { en: 'Nothing needed from you: your accountant is reviewing the work.', es: 'No necesitamos nada de usted: su contador está revisando el trabajo.' },
  'progress.nothing.preparing': { en: 'Nothing needed from you: your accountant is preparing the work.', es: 'No necesitamos nada de usted: su contador está preparando el trabajo.' },
  'progress.m.documents': { en: 'Documents', es: 'Documentos' }, 'progress.m.preparation': { en: 'Preparation', es: 'Preparación' }, 'progress.m.review': { en: 'Review', es: 'Revisión' }, 'progress.m.completed': { en: 'Completed', es: 'Completado' },
  'progress.d.documents': { en: '{received} of {total} received, {accepted} accepted', es: '{received} de {total} recibidos, {accepted} aceptados' },
  'progress.d.preparation': { en: '{done} of {total} steps complete', es: '{done} de {total} pasos completados' },
  'progress.d.inReview': { en: 'in review', es: 'en revisión' }, 'progress.d.reviewed': { en: 'reviewed', es: 'revisado' }, 'progress.d.notStarted': { en: 'not started', es: 'sin comenzar' },
  'progress.d.signedOff': { en: 'signed off', es: 'aprobado' }, 'progress.d.notYet': { en: 'not yet', es: 'todavía no' },
  // Messages, to-dos, tasks
  'todos.title': { en: 'Your to-dos', es: 'Sus tareas' }, 'todos.due': { en: 'due {when}', es: 'vence {when}' }, 'todos.completed': { en: 'completed {when}', es: 'completada {when}' },
  'todos.reply': { en: 'Reply (optional)', es: 'Respuesta (opcional)' }, 'todos.markDone': { en: 'Mark done', es: 'Marcar como hecha' },
  'todos.done': { en: 'To-do completed. Your accountant has been told.', es: 'Tarea completada. Se le avisó a su contador.' },
  'messages.title': { en: 'Messages', es: 'Mensajes' },
  'messages.intro': { en: 'Secure messages about this work only. Your accountant replies here; no email is sent.', es: 'Mensajes seguros solo sobre este trabajo. Su contador responde aquí; no se envía correo electrónico.' },
  'messages.you': { en: 'You', es: 'Usted' }, 'messages.accountant': { en: 'Your accountant', es: 'Su contador' },
  'messages.ask': { en: 'Ask your accountant a question', es: 'Hágale una pregunta a su contador' }, 'messages.send': { en: 'Send question', es: 'Enviar pregunta' },
  'messages.sent': { en: 'Question sent to your accountant.', es: 'Pregunta enviada a su contador.' }, 'messages.failed': { en: 'That did not go through', es: 'No se pudo enviar' },
  'messages.bytes': { en: '{size} bytes', es: '{size} bytes' },
  'tasks.title': { en: 'Progress', es: 'Avance' },
  // Organizers
  'org.version': { en: 'Version {version}. Answer the questions assigned to you. Save your draft to reveal any further sections, or return later using this link.', es: 'Versión {version}. Responda las preguntas que se le asignaron. Guarde su borrador para ver más secciones, o vuelva más tarde con este enlace.' },
  'org.required': { en: ' (required)', es: ' (obligatoria)' }, 'org.choose': { en: 'Choose an answer', es: 'Elija una respuesta' },
  'org.carried': { en: 'Carried from the previous period. Check it and confirm it is current.', es: 'Proviene del período anterior. Revísela y confirme que sigue vigente.' },
  'org.confirm': { en: 'I confirm this answer is current.', es: 'Confirmo que esta respuesta está vigente.' },
  'org.support': { en: 'Supporting document', es: 'Documento de respaldo' }, 'org.supportUploaded': { en: 'Supporting document uploaded.', es: 'Documento de respaldo cargado.' },
  'org.supportHint': { en: 'Save and confirm your answer to add its supporting document request.', es: 'Guarde y confirme su respuesta para agregar la solicitud de su documento de respaldo.' },
  'org.save': { en: 'Save draft', es: 'Guardar borrador' }, 'org.submit': { en: 'Submit answers', es: 'Enviar respuestas' },
  'org.saved': { en: 'Draft saved.', es: 'Borrador guardado.' }, 'org.submitted': { en: 'Answers submitted. Thank you.', es: 'Respuestas enviadas. Gracias.' },
  'org.failed': { en: 'Your answers could not be saved', es: 'No se pudieron guardar sus respuestas' }, 'org.unavailable': { en: 'Organizer unavailable', es: 'Cuestionario no disponible' },
  'org.versions': { en: 'Your submitted versions', es: 'Sus versiones enviadas' }, 'org.submission': { en: 'Submission {n} · {when}', es: 'Envío {n} · {when}' },
  'org.notConfirmed': { en: 'Not confirmed', es: 'Sin confirmar' }, 'org.unconfirmed': { en: ' · unconfirmed', es: ' · sin confirmar' },
  // Signatures
  'sig.title': { en: 'Your signature requests', es: 'Sus solicitudes de firma' },
  'sig.mode': { en: '{mode} · attempt {attempt} · {status}', es: '{mode} · intento {attempt} · {status}' },
  'sig.read': { en: 'Read and download the document', es: 'Lea y descargue el documento' },
  'sig.attest': { en: 'Before you can sign this IRS authorization form, the practice must confirm your identity (photo ID by selfie or video, or personal knowledge). Contact them if you have not been asked.', es: 'Antes de que pueda firmar este formulario de autorización del IRS, la oficina debe confirmar su identidad (identificación con foto por selfi o video, o conocimiento personal). Comuníquese con ellos si no se lo han pedido.' },
  'sig.waiting': { en: 'Waiting for earlier signers. Reopen this request after they finish.', es: 'Esperando a los firmantes anteriores. Vuelva a abrir esta solicitud cuando terminen.' },
  'sig.consentAction': { en: 'Consent and sign document', es: 'Aceptar y firmar el documento' },
  'sig.signingAs': { en: 'Signing as {name}. Review the complete PDF before signing.', es: 'Firma como {name}. Revise el PDF completo antes de firmar.' },
  'sig.field': { en: '{label} (page {page})', es: '{label} (página {page})' },
  'sig.consent': { en: 'I consent to electronic records and signatures for this document.', es: 'Acepto los registros y las firmas electrónicas para este documento.' },
  'sig.intent': { en: 'I am authorized for this client and intend to sign this document.', es: 'Estoy autorizado/a por este cliente y tengo la intención de firmar este documento.' },
  'sig.decline': { en: 'Decline electronic signing', es: 'Rechazar la firma electrónica' }, 'sig.declineReason': { en: 'Reason for declining', es: 'Motivo del rechazo' },
  'sig.declineHint': { en: 'You can ask the practice for a paper copy or another way to sign. Declining does not withdraw any marketing consent.', es: 'Puede pedirle a la oficina una copia en papel u otra forma de firmar. Rechazar no retira ningún consentimiento de mercadeo.' },
  'sig.signedDone': { en: 'Signature recorded.', es: 'Firma registrada.' }, 'sig.declinedDone': { en: 'Decline recorded. Your practice can arrange another way to sign.', es: 'Rechazo registrado. Su oficina puede acordar otra forma de firmar.' },
  'sig.downloadSigned': { en: 'Download signed PDF', es: 'Descargar el PDF firmado' }, 'sig.downloadCertificate': { en: 'Download certificate', es: 'Descargar el certificado' },
  'sig.mode.sequential': { en: 'one after another', es: 'uno tras otro' }, 'sig.mode.parallel': { en: 'any order', es: 'en cualquier orden' },
  // Deliverables
  'del.title': { en: 'For your approval', es: 'Para su aprobación' },
  'del.version': { en: 'Version {version}: {name}', es: 'Versión {version}: {name}' }, 'del.sent': { en: 'sent {when}', es: 'enviado {when}' },
  'del.locked': { en: 'locked', es: 'bloqueado' },
  'del.lockedNotice': { en: 'This file is locked until invoice {invoice} is paid.', es: 'Este archivo está bloqueado hasta que se pague la factura {invoice}.' },
  'del.stillDue': { en: ' {amount} is still due.', es: ' Aún se debe {amount}.' }, 'del.achPending': { en: ' Your ACH payment is pending and has not settled yet.', es: ' Su pago por ACH está pendiente y todavía no se ha liquidado.' },
  'del.yourDocs': { en: ' Documents you gave us stay available.', es: ' Los documentos que usted nos dio siguen disponibles.' },
  'del.approvedBy': { en: 'Approved by {name} on {when}.', es: 'Aprobado por {name} el {when}.' }, 'del.changesBy': { en: '{name} asked for changes on {when}: {comment}', es: '{name} pidió cambios el {when}: {comment}' },
  'del.send': { en: 'Send my answer', es: 'Enviar mi respuesta' }, 'del.name': { en: 'Your name', es: 'Su nombre' }, 'del.answer': { en: 'Your answer', es: 'Su respuesta' },
  'del.approve': { en: 'Approve this version', es: 'Aprobar esta versión' }, 'del.changes': { en: 'Request changes', es: 'Pedir cambios' },
  'del.comment': { en: 'Comment (required when requesting changes)', es: 'Comentario (obligatorio si pide cambios)' },
  'del.approvedDone': { en: 'You approved version {version}. Thank you.', es: 'Usted aprobó la versión {version}. Gracias.' }, 'del.changesDone': { en: 'Your requested changes were sent to your accountant.', es: 'Sus cambios solicitados se enviaron a su contador.' },
  'del.failed': { en: 'Your answer was not recorded', es: 'No se registró su respuesta' },
  // Credentials
  'cred.title': { en: 'Logins you share with your accountant', es: 'Inicios de sesión que comparte con su contador' },
  'cred.intro': { en: 'Stored encrypted. Only staff on your account can open them, and each opening is logged. Saved passwords are never shown here again; to change one, enter it in full.', es: 'Se guardan cifrados. Solo el personal de su cuenta puede abrirlos y cada apertura queda registrada. Las contraseñas guardadas no se vuelven a mostrar aquí; para cambiar una, escríbala completa.' },
  'cred.updated': { en: '{label} · updated {when}', es: '{label} · actualizado {when}' }, 'cred.replace': { en: 'Replace login', es: 'Reemplazar el inicio de sesión' },
  'cred.add': { en: 'Add a login', es: 'Agregar un inicio de sesión' }, 'cred.save': { en: 'Save login', es: 'Guardar inicio de sesión' },
  'cred.saved': { en: 'Login saved. Thank you.', es: 'Inicio de sesión guardado. Gracias.' }, 'cred.updatedDone': { en: '{label} updated.', es: '{label} actualizado.' }, 'cred.failed': { en: 'That did not save', es: 'No se guardó' },
  'cred.name': { en: 'Name', es: 'Nombre' }, 'cred.nameHint': { en: 'For example: Ohio sales-tax portal', es: 'Por ejemplo: portal de impuesto sobre ventas de Ohio' },
  'cred.url': { en: 'Portal address', es: 'Dirección del portal' }, 'cred.username': { en: 'Username', es: 'Usuario' }, 'cred.password': { en: 'Password', es: 'Contraseña' },
  'cred.notes': { en: 'Notes, such as security answers', es: 'Notas, como respuestas de seguridad' }, 'cred.rotate': { en: 'Rotation reminder date (optional)', es: 'Fecha del recordatorio de cambio (opcional)' },
  // Invoice page
  'inv.opening': { en: 'Opening invoice…', es: 'Abriendo la factura…' },
  'inv.forRecipient': { en: '{client} · for {recipient}', es: '{client} · para {recipient}' },
  'inv.dates': { en: 'Issued {issued} · due {due}', es: 'Emitida {issued} · vence {due}' },
  'inv.amounts': { en: 'Amount at issue {total} · ', es: 'Importe al emitirse {total} · ' }, 'inv.balance': { en: 'Current balance {balance}', es: 'Saldo actual {balance}' },
  'inv.tax': { en: 'Supplied tax {tax} · {treatment}', es: 'Impuesto indicado {tax} · {treatment}' }, 'inv.download': { en: 'Download invoice PDF', es: 'Descargar la factura en PDF' },
  'inv.private': { en: 'Private invoice link; expires {when}. SHA-256 {sha}', es: 'Enlace privado de la factura; vence {when}. SHA-256 {sha}' },
  // Emails
  'mail.hello': { en: 'Hello {name},', es: 'Hola {name},' },
  'mail.request.subject': { en: 'Documents needed: {work}', es: 'Documentos necesarios: {work}' },
  'mail.request.intro': { en: 'We need the following documents for {work}:', es: 'Necesitamos los siguientes documentos para {work}:' },
  'mail.request.upload': { en: 'Upload them securely here: {url}', es: 'Cárguelos de forma segura aquí: {url}' },
  'mail.expires': { en: 'This link expires on {date}.', es: 'Este enlace vence el {date}.' },
  'mail.deliverable.subject': { en: 'For your approval: {title} v{version}', es: 'Para su aprobación: {title} v{version}' },
  'mail.deliverable.intro': { en: 'Please review {title} (version {version}) for {work}.', es: 'Por favor, revise {title} (versión {version}) de {work}.' },
  'mail.deliverable.action': { en: 'Approve it or request changes here: {url}', es: 'Apruébelo o pida cambios aquí: {url}' },
  'mail.organizer.subject': { en: 'Organizer: {work}', es: 'Cuestionario: {work}' },
  // A message template body: read verbatim, its {{placeholders}} are filled by the template renderer.
  'mail.organizer.body': { en: 'Hello {{contact_first_name}},\nPlease complete your assigned questions for {{work_item}} ({{period}}).\n{{portal_link}}', es: 'Hola {{contact_first_name}},\nPor favor, complete las preguntas que se le asignaron para {{work_item}} ({{period}}).\n{{portal_link}}' },
  'mail.signature.subject': { en: 'Document signature request', es: 'Solicitud de firma de documento' },
  'mail.signature.review': { en: 'Please review and sign {title}.', es: 'Por favor, revise y firme {title}.' },
  'mail.signature.sequential': { en: 'Sequential signing: you are signer {n} of {total}. You may review now and sign when all earlier signers finish.', es: 'Firma en orden: usted es el firmante {n} de {total}. Puede revisar ahora y firmar cuando terminen todos los anteriores.' },
  'mail.signature.parallel': { en: 'Parallel signing: you may sign now.', es: 'Firma en cualquier orden: puede firmar ahora.' },
  'mail.signature.optional': { en: 'Electronic signing is optional. You may decline with a reason and ask for paper signing.', es: 'La firma electrónica es opcional. Puede rechazarla con un motivo y pedir firmar en papel.' },
  'mail.invoice.body': { en: 'Please find {number} attached. Amount due: {amount}. Due date: {due}.', es: 'Adjuntamos la factura {number}. Importe a pagar: {amount}. Fecha de vencimiento: {due}.' },
  'mail.invoice.portal': { en: 'Invoice portal: {url}', es: 'Portal de facturas: {url}' },
  'mail.invoice.expires': { en: 'This private link expires on {date}.', es: 'Este enlace privado vence el {date}.' },
  'mail.marketing.footer': { en: 'You receive marketing email from {firm} because you opted in. Unsubscribe: {url}', es: 'Recibe correo de mercadeo de {firm} porque lo aceptó. Cancelar la suscripción: {url}' },
  // Unsubscribe page
  'unsub.title': { en: 'Unsubscribe', es: 'Cancelar la suscripción' }, 'unsub.heading': { en: 'Unsubscribe from marketing email', es: 'Cancelar el correo de mercadeo' },
  'unsub.footer': { en: 'No sign-in or fee is needed, and it takes effect immediately.', es: 'No se necesita iniciar sesión ni pagar, y surte efecto de inmediato.' },
  'unsub.invalid': { en: 'This unsubscribe link is not valid; type your email address instead', es: 'Este enlace para cancelar no es válido; escriba su correo electrónico en su lugar' },
  'unsub.done': { en: '{address} will receive no more marketing email from {firm}, starting now. Messages about work the practice is doing for you still arrive.', es: '{address} no recibirá más correo de mercadeo de {firm} a partir de ahora. Los mensajes sobre el trabajo que la oficina hace para usted seguirán llegando.' },
  'unsub.button': { en: 'Unsubscribe from marketing email', es: 'Cancelar el correo de mercadeo' },
  'unsub.or': { en: 'Or type the address that receives it.', es: 'O escriba la dirección que lo recibe.' },
  'unsub.address': { en: 'Email address', es: 'Correo electrónico' }, 'unsub.addressButton': { en: 'Unsubscribe this address', es: 'Cancelar esta dirección' },
  'unsub.thisPractice': { en: 'this practice', es: 'esta oficina' },
} satisfies Record<string, Entry>;

export type Key = keyof typeof C;
/** The text for a key in a language, with {name} placeholders filled from vars. */
export function tr(language: Language, key: Key, vars: Record<string, string | number> = {}): string {
  return C[key][language].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
/** The text for a key exactly as written, for message templates whose {{placeholders}} the template renderer fills. */
export const verbatim = (language: Language, key: Key): string => C[key][language];
export const hasKey = (key: string): key is Key => Object.hasOwn(C, key);
