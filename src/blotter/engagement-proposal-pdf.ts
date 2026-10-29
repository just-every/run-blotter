import { PDFDocument, StandardFonts } from 'pdf-lib';
import { insist, type Data } from './model';

/** Human-authored terms only. Nothing here infers services, consent or financial authority. */
export async function proposalPdf(terms:Data,version:number,contactIds:string[]) {
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  let page=pdf.addPage([612,792]),y=750;
  const line=(value:string)=>{
    if(y<60){page=pdf.addPage([612,792]);y=750;}
    page.drawText(value,{x:40,y,font,size:12});y-=18;
  };
  const paragraph=(value:string)=>{
    try{font.encodeText(value);}catch{insist(false,'Proposal terms contain characters unsupported by the PDF font');}
    for(const original of value.split(/\r?\n/)){
      let remaining=original;
      while(remaining.length){let end=remaining.length;while(end>0&&font.widthOfTextAtSize(remaining.slice(0,end),12)>530)end--;
        insist(end>0,'Proposal text cannot be rendered');
        if(end<remaining.length&&remaining.lastIndexOf(' ',end)>0)end=remaining.lastIndexOf(' ',end);
        line(remaining.slice(0,end));remaining=remaining.slice(end).replace(/^ /,'');
      }
      line('');
    }
  };
  for(const [label,value] of [['Engagement proposal',terms.title],['Version',String(version)],['Scope',terms.scope],['Exclusions',terms.exclusions],['Fee in USD',`${terms.feeCents} integer cents (${(terms.feeCents/100).toFixed(2)} USD)`],['Retainer terms',terms.retainerTerms],['Renewal rules',terms.renewalRules],['Amendment rules',terms.amendmentRules]]){line(label+':');paragraph(value);}
  paragraph('Electronic signing consent is requested separately. Marketing consent is separate and is never required for service. Signing this letter does not initiate billing, collection or onboarding.');
  page=pdf.addPage([612,792]);y=750;line(`Engagement proposal version ${version}: signatures`);
  const fields=contactIds.map((contactId,index)=>{const top=110+index*110;page.drawText(`Authorized signer ${index+1}`,{x:40,y:792-top+18,font,size:12});return {contactId,type:'signature',page:pdf.getPageCount(),x:40,y:top,width:510,height:38,label:`Proposal signature ${index+1}`};});
  return {bytes:await pdf.save(),fields};
}
