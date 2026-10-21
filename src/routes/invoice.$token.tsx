import {createFileRoute} from '@tanstack/react-router';
import {HydrationUnit} from '../base/hydration/unit';
import {InvoicePortal} from '../ui/invoices';
export const Route=createFileRoute('/invoice/$token')({
 head:()=>({meta:[{name:'referrer',content:'no-referrer'},{name:'robots',content:'noindex'}]}),
 component:()=>{const {token}=Route.useParams();return <HydrationUnit><InvoicePortal token={token}/></HydrationUnit>},
});
