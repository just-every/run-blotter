import { useLanguage } from './i18n';

export function AiDisclosure() {
  const spanish=useLanguage()==='es';
  return <details><summary>{spanish ? 'Información de la firma' : 'Firm disclosure'}</summary>
    <p>{spanish
      ? 'El personal de la firma puede utilizar un proveedor de inteligencia artificial para preparar resúmenes y propuestas a partir de texto seleccionado de sus documentos y conversaciones del portal, con datos sensibles ocultos. Una persona revisa las propuestas. La inteligencia artificial no envía respuestas, presenta declaraciones ni proporciona asesoramiento legal o fiscal.'
      : 'Firm staff may use an AI provider to prepare summaries and proposals from selected text in your documents and portal conversations, with sensitive details masked. A person reviews the proposals. AI does not send replies, file returns or provide legal or tax advice.'}</p>
  </details>;
}
