import { CustomerListScreen } from '../components/CustomerListScreen';

/**
 * Everyone the shop has ever sold to on credit, searchable by name or phone.
 * Same screen as বাকি with the filter off, so the two never disagree.
 */
export function CustomersPage() {
  return <CustomerListScreen mode="all" />;
}
