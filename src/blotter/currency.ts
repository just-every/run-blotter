// Currency is stored with each amount. Existing rows are AUD; new inputs default to USD.
import { insist } from './model';
export type Currency = 'USD' | 'AUD';
export function currency(value: unknown = 'USD'): Currency {
  insist(value === 'USD' || value === 'AUD', 'Choose USD or AUD');
  return value;
}
