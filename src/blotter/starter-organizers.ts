// Authored starting organizers, for firm review and tailoring to the engagement.
import type { OrganizerDefinition } from './organizers-definition';
export function starterOrganizer(name: string, version: number): OrganizerDefinition {
  const tax = /return|941|withholding|1099|w-2|unemployment|tax|corporation|partnership/i.test(name);
  return { name: name + ' organizer', kind: tax ? 'tax' : 'bookkeeping', version, questions: [
    { key:'changes',label:tax ? 'Have entity, household or reporting circumstances changed since the prior period?' : 'Have accounts, services or responsible contacts changed since the prior period?',type:'choice',options:['Yes','No'],required:true,when:null,request:'',workflowQuestion:'' },
    { key:'change_details',label:'Describe the changes that your accountant should review',type:'text',options:[],required:true,when:{question:'changes',values:['Yes']},request:'Records supporting the reported changes',workflowQuestion:'' },
    { key:'outstanding',label:'What information is still outstanding or needs discussion?',type:'text',options:[],required:false,when:null,request:'',workflowQuestion:'' },
  ] };
}
